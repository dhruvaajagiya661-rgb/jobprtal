"""
Advanced AI Assistant for PortAL.
Provides context-aware, database-driven responses about jobs, internships,
career paths, skill gaps, and personalized recommendations.
Supports OpenAI integration when API key is configured.
"""

import json
import os
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.apps import apps
from django.db import models

logger = logging.getLogger(__name__)


class AIConsumer(AsyncWebsocketConsumer):
    """
    Intelligent AI Assistant with:
    - Database-driven responses (no API key needed)
    - OpenAI integration (when OPENAI_API_KEY is set)
    - Personalized recommendations for authenticated users
    - Context-aware conversation flows
    """

    async def connect(self):
        await self.accept()
        self.conversation_history = []
        self.user_context = {}

    async def disconnect(self, close_code):
        pass

    # ─── Database Queries ─────────────────────────────────────

    @database_sync_to_async
    def get_platform_stats(self):
        """Get overall platform statistics."""
        Job = apps.get_model("jobs", "Job")
        Internship = apps.get_model("internships", "Internship")
        Application = apps.get_model("applications", "Application")
        User = apps.get_model("accounts", "CustomUser")
        Company = apps.get_model("recruiters", "Company")
        CareerPath = apps.get_model("careers", "CareerPath")

        return {
            "total_jobs": Job.objects.filter(is_active=True).count(),
            "total_internships": Internship.objects.filter(is_active=True).count(),
            "total_applications": Application.objects.count(),
            "total_students": User.objects.filter(is_student=True).count(),
            "total_recruiters": User.objects.filter(is_recruiter=True).count(),
            "total_companies": Company.objects.count(),
            "career_paths": list(
                CareerPath.objects.filter(is_active=True).values_list("name", flat=True)
            ),
        }

    @database_sync_to_async
    def get_user_context_data(self, user):
        """Get personalized data for an authenticated user."""
        if not user.is_authenticated:
            return None

        context = {
            "username": user.username,
            "is_student": user.is_student,
            "is_recruiter": user.is_recruiter,
            "email": user.email,
            "date_joined": user.date_joined.strftime("%B %Y"),
        }

        if user.is_student:
            StudentProfile = apps.get_model("students", "StudentProfile")
            Application = apps.get_model("applications", "Application")

            profile = StudentProfile.objects.filter(user=user).first()
            if profile:
                context["skills"] = list(profile.skills.values_list("name", flat=True))
                context["has_resume"] = bool(profile.resume)
                context["education"] = bool(profile.education)
                context["experience"] = bool(profile.experience)

            apps_list = Application.objects.filter(student=user)
            context["applications_count"] = apps_list.count()
            context["shortlisted_count"] = apps_list.filter(
                status="Shortlisted"
            ).count()
            context["accepted_count"] = apps_list.filter(status="Accepted").count()

        elif user.is_recruiter:
            RecruiterProfile = apps.get_model("recruiters", "RecruiterProfile")
            Job = apps.get_model("jobs", "Job")

            profile = RecruiterProfile.objects.filter(user=user).first()
            if profile and profile.company:
                context["company"] = profile.company.name

            from recruiters.scoping import scope_postings

            context["jobs_posted"] = scope_postings(
                Job.objects.all(), user
            ).count()

        return context

    @database_sync_to_async
    def search_jobs(self, query, limit=5):
        """Search jobs by title, company, skills."""
        Job = apps.get_model("jobs", "Job")
        jobs = Job.objects.filter(is_active=True).select_related("company", "category")

        if query:
            jobs = jobs.filter(
                models.Q(title__icontains=query)
                | models.Q(company__name__icontains=query)
                | models.Q(skills_required__name__icontains=query)
                | models.Q(location__icontains=query)
            ).distinct()

        results = []
        for job in jobs[:limit]:
            skills = list(job.skills_required.values_list("name", flat=True))
            results.append(
                {
                    "title": job.title,
                    "company": job.company.name,
                    "location": job.location,
                    "salary": job.salary,
                    "job_type": job.job_type,
                    "url": f"/jobs/{job.id}/",
                    "skills": skills[:5],
                }
            )
        return results

    @database_sync_to_async
    def search_internships(self, query, limit=5):
        """Search internships by title, company, skills."""
        Internship = apps.get_model("internships", "Internship")
        internships = Internship.objects.filter(is_active=True).select_related(
            "company"
        )

        if query:
            internships = internships.filter(
                models.Q(title__icontains=query)
                | models.Q(company__name__icontains=query)
            ).distinct()

        results = []
        for intern in internships[:limit]:
            skills = list(intern.skills_required.values_list("name", flat=True))
            results.append(
                {
                    "title": intern.title,
                    "company": intern.company.name,
                    "location": intern.location,
                    "stipend": intern.stipend,
                    "duration": intern.duration,
                    "url": f"/internships/{intern.id}/",
                    "skills": skills[:5],
                }
            )
        return results

    @database_sync_to_async
    def get_career_paths_summary(self):
        """Get summary of all career paths."""
        CareerPath = apps.get_model("careers", "CareerPath")
        paths = CareerPath.objects.filter(is_active=True).annotate(
            milestone_count=models.Count("milestones")
        )
        return [
            {
                "name": p.name,
                "description": p.description[:100],
                "salary_range": f"${p.avg_salary_min}K-${p.avg_salary_max}K",
                "milestones": p.milestone_count,
                "url": f"/careers/paths/{p.id}/",
            }
            for p in paths
        ]

    @database_sync_to_async
    def get_skill_gap_summary(self, user):
        """Get skill gap analysis for a student."""
        if not user.is_authenticated or not user.is_student:
            return None
        from careers.services import SkillGapService

        StudentProfile = apps.get_model("students", "StudentProfile")
        profile = StudentProfile.objects.filter(user=user).first()
        if not profile:
            return None
        analysis = SkillGapService.analyze_gaps(profile)
        return {
            "your_skills_count": analysis["student_skill_count"],
            "missing_skills_count": analysis["total_missing_skills"],
            "top_missing_skills": [s[0] for s in analysis["skill_demand"][:5]],
            "jobs_analyzed": analysis["total_jobs_analyzed"],
        }

    @database_sync_to_async
    def get_recommendations(self, user):
        """Get personalized job/internship recommendations."""
        if not user.is_authenticated or not user.is_student:
            return None
        from careers.services import JobMatchingService

        StudentProfile = apps.get_model("students", "StudentProfile")
        profile = StudentProfile.objects.filter(user=user).first()
        if not profile:
            return None
        jobs = JobMatchingService.get_recommended_jobs(profile, limit=3)
        internships = JobMatchingService.get_recommended_internships(profile, limit=2)
        return {
            "jobs": [
                {
                    "title": r["job"].title,
                    "company": r["job"].company.name,
                    "score": r["score"],
                    "url": f"/jobs/{r['job'].id}/",
                }
                for r in jobs
            ],
            "internships": [
                {
                    "title": r["internship"].title,
                    "company": r["internship"].company.name,
                    "score": r["score"],
                    "url": f"/internships/{r['internship'].id}/",
                }
                for r in internships
            ],
        }

    @database_sync_to_async
    def get_recent_activity(self, user):
        """Get recent activity for a student."""
        if not user.is_authenticated or not user.is_student:
            return None
        Application = apps.get_model("applications", "Application")
        Notification = apps.get_model("notifications", "Notification")

        recent_apps = (
            Application.objects.filter(student=user)
            .select_related("job__company")
            .order_by("-applied_at")[:5]
        )

        recent_notifications = Notification.objects.filter(
            user=user, is_read=False
        ).order_by("-created_at")[:3]

        return {
            "recent_applications": [
                {
                    "title": a.job.title if a.job else a.internship.title,
                    "company": (
                        a.job.company.name if a.job else a.internship.company.name
                    ),
                    "status": a.status,
                    "date": a.applied_at.strftime("%b %d"),
                }
                for a in recent_apps
            ],
            "unread_notifications": [
                {"title": n.title, "message": n.message[:80]}
                for n in recent_notifications
            ],
            "unread_count": recent_notifications.count(),
        }

    # ─── Response Generation ──────────────────────────────────

    def _format_response(self, intent, data, user_message):
        """Generate rich, formatted responses based on intent and data."""

        responses = {
            "greeting": lambda: (
                f"Hello{' ' + data.get('username', '') if data else ''}! 👋 "
                "I'm your **PortAL AI Assistant**. I can help you with:\n\n"
                "🔍 **Find Jobs / Internships** — Search by skill, company, or location\n"
                "📊 **Your Dashboard** — Application status, stats, and activity\n"
                "🧭 **Career Paths** — Explore career tracks and milestones\n"
                "📝 **Skill Gap Analysis** — Find out what to learn next\n"
                "🎯 **Interview Prep** — Practice with curated questions\n\n"
                "What would you like to explore?"
            ),
            "stats": lambda: (
                f"📊 **PortAL Platform Overview**\n\n"
                f"💼 Active Jobs: **{data.get('total_jobs', 0)}**\n"
                f"🎓 Internships: **{data.get('total_internships', 0)}**\n"
                f"👥 Students: **{data.get('total_students', 0)}**\n"
                f"🏢 Companies: **{data.get('total_companies', 0)}**\n"
                f"📋 Total Applications: **{data.get('total_applications', 0)}**\n\n"
                f"🧭 Career Tracks: {', '.join(data.get('career_paths', [])[:5])}\n\n"
                f"Browse all opportunities in [Jobs](/jobs/) or [Internships](/internships/)!"
            ),
            "personal_summary": lambda: (
                f"📋 **Your Profile Summary**\n\n"
                f"👤 Username: **{data.get('username')}**\n"
                f"📧 {data.get('email')}\n"
                f"📅 Joined: {data.get('date_joined')}\n\n"
                + (
                    f"🎯 Applications: **{data.get('applications_count', 0)}**\n"
                    f"⭐ Shortlisted: **{data.get('shortlisted_count', 0)}**\n"
                    f"🏆 Accepted: **{data.get('accepted_count', 0)}**\n"
                    f"🛠️ Skills: {', '.join(data.get('skills', []))[:100]}\n"
                    f"📄 Resume: {'✅ Uploaded' if data.get('has_resume') else '❌ Not uploaded'}\n\n"
                    f"View your full [Dashboard](/student/dashboard/)!"
                    if data.get("is_student")
                    else (
                        f"💼 Jobs Posted: **{data.get('jobs_posted', 0)}**\n"
                        f"🏢 Company: **{data.get('company', 'Not set')}**\n\n"
                        f"View your [Company Profile](/recruiter/company/)!"
                        if data.get("is_recruiter")
                        else ""
                    )
                )
            ),
            "search_jobs": lambda: (
                "🔍 **Job Search Results**\n\n"
                + (
                    "\n".join(
                        [
                            f"**{j['title']}** at *{j['company']}*\n"
                            f"📍 {j['location']} | 💰 {j['salary']} | 🏷️ {j['job_type']}\n"
                            f"🛠️ Skills: {', '.join(j['skills'][:4])}\n"
                            f"[View Details]({j['url']})"
                            for j in data.get("results", [])
                        ]
                    )
                    if data.get("results")
                    else "No matching jobs found. Try different keywords!"
                )
                + ("\n\n[Browse All Jobs →](/jobs/)" if data.get("results") else "")
            ),
            "search_internships": lambda: (
                "🔍 **Internship Search Results**\n\n"
                + (
                    "\n".join(
                        [
                            f"**{i['title']}** at *{i['company']}*\n"
                            f"📍 {i['location']} | 💰 {i['stipend']} | ⏱️ {i['duration']}\n"
                            f"🛠️ Skills: {', '.join(i['skills'][:4])}\n"
                            f"[View Details]({i['url']})"
                            for i in data.get("results", [])
                        ]
                    )
                    if data.get("results")
                    else "No matching internships found."
                )
                + (
                    "\n\n[Browse All Internships →](/internships/)"
                    if data.get("results")
                    else ""
                )
            ),
            "career_paths": lambda: (
                "🧭 **Career Paths Available**\n\n"
                + "\n".join(
                    [
                        f"**{p['name']}** — {p['description']}\n"
                        f"💰 {p['salary_range']} | 📊 {p['milestones']} levels\n"
                        f"[Explore Path →]({p['url']})"
                        for p in data.get("paths", [])
                    ]
                )
                + "\n\nWhich career path interests you? I can provide more details!"
            ),
            "skill_gap": lambda: (
                f"📝 **Your Skill Gap Analysis**\n\n"
                f"🛠️ Your Skills: **{data.get('your_skills_count', 0)}**\n"
                f"🎯 Missing Skills: **{data.get('missing_skills_count', 0)}**\n"
                f"💼 Jobs Analyzed: **{data.get('jobs_analyzed', 0)}**\n\n"
                + (
                    "**Top skills to learn:**\n"
                    + "\n".join([f"• {s}" for s in data.get("top_missing_skills", [])])
                    + "\n\n[View Full Analysis →](/careers/skill-gap/)"
                    if data.get("top_missing_skills")
                    else "Great job! Your skills match the current market demands! 🎉"
                )
            ),
            "recommendations": lambda: (
                "🎯 **Personalized Recommendations**\n\n"
                + (
                    "**Recommended Jobs:**\n"
                    + "\n".join(
                        [
                            f"• **{r['title']}** at {r['company']} — {r['score']}% match [Apply →]({r['url']})"
                            for r in data.get("jobs", [])
                        ]
                    )
                    + "\n\n"
                    if data.get("jobs")
                    else ""
                )
                + (
                    "**Recommended Internships:**\n"
                    + "\n".join(
                        [
                            f"• **{r['title']}** at {r['company']} — {r['score']}% match [Apply →]({r['url']})"
                            for r in data.get("internships", [])
                        ]
                    )
                    if data.get("internships")
                    else ""
                )
                + (
                    "\n\n_Update your profile skills to get better recommendations!_"
                    if not data.get("jobs")
                    else ""
                )
            ),
            "recent_activity": lambda: (
                "📊 **Your Recent Activity**\n\n"
                + (
                    f"🔔 Unread Notifications: **{data.get('unread_count', 0)}**\n\n"
                    if data.get("unread_count")
                    else ""
                )
                + (
                    "**Recent Applications:**\n"
                    + "\n".join(
                        [
                            f"• **{a['title']}** at {a['company']} — {a['status']} ({a['date']})"
                            for a in data.get("recent_applications", [])
                        ]
                    )
                    + "\n\n"
                    if data.get("recent_applications")
                    else "No recent applications.\n\n"
                )
                + (
                    "**Notifications:**\n"
                    + "\n".join(
                        [
                            f"• {n['title']}: {n['message']}"
                            for n in data.get("unread_notifications", [])
                        ]
                    )
                    if data.get("unread_notifications")
                    else ""
                )
                + "\n[View Full Dashboard →](/student/dashboard/)"
            ),
            "help": lambda: (
                "🤔 **Here's what I can help you with:**\n\n"
                '• **"Find me jobs"** — Search available positions\n'
                '• **"Show me internships"** — Browse internship opportunities\n'
                '• **"My status"** — Check your application statuses\n'
                '• **"Career paths"** — Explore career tracks\n'
                '• **"Skill gaps"** — Analyze what to learn next\n'
                '• **"Recommendations"** — Get personalized job picks\n'
                '• **"Platform stats"** — See overall platform data\n'
                '• **"My profile"** — Check your profile summary\n'
                '• **"Recent activity"** — See what\'s new with your applications\n\n'
                "What would you like help with?"
            ),
            "fallback": lambda: (
                "I'm not sure I understand that. Here are some things you can ask me:\n\n"
                '🔍 **"Find Python jobs"** — Search for specific jobs\n'
                '📊 **"Show platform stats"** — See overall numbers\n'
                '🧭 **"Career paths"** — Explore career tracks\n'
                '📝 **"My profile"** — Check your info\n'
                '🎯 **"Recommendations"** — Get personalized suggestions\n'
                '🤔 **"Help"** — See what all I can do'
            ),
        }

        formatter = responses.get(intent, responses["fallback"])
        return formatter()

    # ─── Intent Detection ──────────────────────────────────────

    def _detect_intent(self, message):
        """Detect user intent from message."""
        message_lower = message.lower().strip()

        # Greetings
        if any(
            w in message_lower
            for w in ["hi", "hello", "hey", "greetings", "sup", "howdy"]
        ):
            return "greeting", None

        # Help
        if any(
            w in message_lower
            for w in ["help", "what can you do", "capabilities", "commands"]
        ):
            return "help", None

        # Platform stats
        if any(
            w in message_lower
            for w in [
                "platform stats",
                "overall stats",
                "site stats",
                "how many",
                "platform overview",
                "total jobs",
                "how many users",
            ]
        ):
            return "stats", "platform"

        # Personal summary / profile
        if any(
            w in message_lower
            for w in [
                "my profile",
                "my info",
                "who am i",
                "my details",
                "show my info",
                "about me",
                "my account",
            ]
        ):
            return "personal_summary", "user"

        # Search jobs
        if any(
            w in message_lower
            for w in [
                "find job",
                "search job",
                "look for job",
                "job search",
                "show job",
                "list job",
                "available job",
                "openings",
            ]
        ):
            return "search_jobs", message_lower

        # Search internships
        if any(
            w in message_lower
            for w in [
                "find intern",
                "search intern",
                "internship search",
                "show intern",
                "list intern",
                "available intern",
            ]
        ):
            return "search_internships", message_lower

        # Career paths
        if any(
            w in message_lower
            for w in [
                "career path",
                "career track",
                "career roadmap",
                "career progression",
                "career",
            ]
        ):
            return "career_paths", None

        # Skill gap
        if any(
            w in message_lower
            for w in [
                "skill gap",
                "what to learn",
                "missing skill",
                "improve skill",
                "learning path",
                "skill analysis",
            ]
        ):
            return "skill_gap", None

        # Recommendations
        if any(
            w in message_lower
            for w in [
                "recommend",
                "suggestion",
                "match me",
                "what should i apply",
                "personalized",
                "best for me",
                "good fit",
            ]
        ):
            return "recommendations", None

        # Recent activity / status
        if any(
            w in message_lower
            for w in [
                "my status",
                "my application",
                "activity",
                "what new",
                "recent",
                "updates",
                "notification",
                "how am i doing",
            ]
        ):
            return "recent_activity", None

        # Application status shorthand
        if any(
            w in message_lower
            for w in ["applied", "shortlisted", "accepted", "rejected"]
        ):
            return "recent_activity", "status"

        return "fallback", message_lower

    # ─── OpenAI Integration (when API key is set) ─────────────

    @database_sync_to_async
    def _get_openai_response(self, user_message, context):
        """Try to use OpenAI for intelligent responses."""
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return None  # No API key, use rule-based

        try:
            from openai import OpenAI

            client = OpenAI(api_key=api_key)

            system_prompt = (
                "You are PortAL AI Assistant, a helpful career guidance AI for a job/internship portal. "
                "You help students find jobs, prepare for interviews, plan careers, and understand "
                "the job market. Be concise, friendly, and provide actionable advice. "
                "You can reference the user's profile data to give personalized responses. "
                f"User context: {json.dumps(context, default=str)}"
            )

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=500,
                temperature=0.7,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.warning(f"OpenAI API error: {e}")
            return None

    # ─── Main Receive Handler ──────────────────────────────────

    async def receive(self, text_data):
        data = json.loads(text_data)
        user_message = data.get("message", "").strip()
        user = self.scope.get("user")

        if not user_message:
            return

        # Store in conversation history
        self.conversation_history.append({"role": "user", "message": user_message})

        # Try OpenAI first (if API key is configured)
        user_context_data = await self.get_user_context_data(user)
        openai_response = await self._get_openai_response(
            user_message,
            {
                "user": user_context_data,
                "conversation_history": self.conversation_history[-5:],
            },
        )

        if openai_response:
            response = openai_response
        else:
            # Fall back to intelligent rule-based system
            intent, query = self._detect_intent(user_message)
            response_data = {}

            if intent == "greeting":
                response_data = user_context_data or {"username": None}

            elif intent == "stats":
                response_data = await self.get_platform_stats()

            elif intent == "personal_summary":
                response_data = user_context_data or {}

            elif intent == "search_jobs":
                search_query = (
                    query.replace("find job", "")
                    .replace("search job", "")
                    .replace("look for job", "")
                    .replace("show job", "")
                    .replace("list job", "")
                    .replace("available job", "")
                    .replace("openings", "")
                    .replace("job search", "")
                    .strip()
                )
                results = await self.search_jobs(search_query if search_query else None)
                response_data = {"results": results}

            elif intent == "search_internships":
                search_query = (
                    query.replace("find intern", "")
                    .replace("search intern", "")
                    .replace("show intern", "")
                    .replace("list intern", "")
                    .replace("available intern", "")
                    .replace("internship search", "")
                    .strip()
                )
                results = await self.search_internships(
                    search_query if search_query else None
                )
                response_data = {"results": results}

            elif intent == "career_paths":
                paths = await self.get_career_paths_summary()
                response_data = {"paths": paths}

            elif intent == "skill_gap":
                analysis = await self.get_skill_gap_summary(user)
                response_data = analysis or {}

            elif intent == "recommendations":
                recs = await self.get_recommendations(user)
                response_data = recs or {}

            elif intent == "recent_activity":
                activity = await self.get_recent_activity(user)
                response_data = activity or {}

            response = self._format_response(intent, response_data, user_message)

        # Store response in history
        self.conversation_history.append(
            {"role": "assistant", "message": response[:100]}
        )

        await self.send(
            text_data=json.dumps({"message": response, "sender": "AI Assistant"})
        )
