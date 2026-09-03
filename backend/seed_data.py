import os
import django
import random
from datetime import date, timedelta

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "portal.settings")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from recruiters.models import Company, RecruiterProfile  # noqa: E402
from jobs.models import Skill, Category, Job  # noqa: E402
from internships.models import Internship  # noqa: E402
from applications.models import Application  # noqa: E402
from notifications.models import Notification  # noqa: E402
from analytics.models import AuditLog  # noqa: E402

User = get_user_model()


def clear_data():
    print("Clearing existing data...")
    Application.objects.all().delete()
    Notification.objects.all().delete()
    AuditLog.objects.all().delete()
    Job.objects.all().delete()
    Internship.objects.all().delete()
    RecruiterProfile.objects.all().delete()
    Company.objects.all().delete()
    # Keep skills and categories but we can refresh them
    print("Data cleared.")


def seed_data():
    print("Starting real data seeding...")

    # 1. Create Skills
    skills_list = [
        "Python",
        "Django",
        "React",
        "JavaScript",
        "TypeScript",
        "PostgreSQL",
        "AWS",
        "Docker",
        "Kubernetes",
        "Machine Learning",
        "Data Analysis",
        "UI/UX Design",
        "Swift",
        "Kotlin",
        "Java",
    ]
    skills = []
    for skill_name in skills_list:
        skill, created = Skill.objects.get_or_create(name=skill_name)
        skills.append(skill)

    # 2. Create Categories
    categories_list = [
        "Software Engineering",
        "Data Science",
        "Product Management",
        "Design",
        "Marketing",
        "Mobile Development",
        "DevOps",
        "Cybersecurity",
    ]
    categories_objs = {}
    for cat_name in categories_list:
        cat, created = Category.objects.get_or_create(name=cat_name)
        categories_objs[cat_name] = cat

    # 3. Real Company Data
    companies_data = [
        {
            "name": "Google",
            "description": "Google mission is to organize the world information and make it universally accessible and useful.",
            "industry": "Technology",
            "size": "100,000+",
            "website": "https://about.google",
            "location": "Mountain View, CA",
        },
        {
            "name": "Microsoft",
            "description": "Microsoft enables digital transformation for the era of an intelligent cloud and an intelligent edge.",
            "industry": "Software",
            "size": "150,000+",
            "website": "https://www.microsoft.com",
            "location": "Redmond, WA",
        },
        {
            "name": "Amazon",
            "description": "Amazon is guided by four principles: customer obsession rather than competitor focus, passion for invention, commitment to operational excellence, and long-term thinking.",
            "industry": "E-commerce & Cloud",
            "size": "1,000,000+",
            "website": "https://www.amazon.jobs",
            "location": "Seattle, WA",
        },
        {
            "name": "Meta",
            "description": "Metas focus is to bring the metaverse to life and help people connect, find communities and grow businesses.",
            "industry": "Social Media",
            "size": "70,000+",
            "website": "https://about.meta.com",
            "location": "Menlo Park, CA",
        },
        {
            "name": "Apple",
            "description": "Apple is a leader in innovation with iPhone, iPad, Mac, Apple Watch, and Apple TV.",
            "industry": "Consumer Electronics",
            "size": "140,000+",
            "website": "https://www.apple.com/jobs",
            "location": "Cupertino, CA",
        },
        {
            "name": "Netflix",
            "description": "Netflix is the worlds leading streaming entertainment service with 200 million paid memberships.",
            "industry": "Entertainment",
            "size": "10,000+",
            "website": "https://jobs.netflix.com",
            "location": "Los Gatos, CA",
        },
    ]

    # One recruiter per company. A recruiter account represents a company, and
    # every recruiter-facing query is scoped to that company
    # (see recruiters/scoping.py) -- so seeding a single recruiter who owns
    # six companies' postings produces a console showing rival employers'
    # jobs side by side, which is exactly what the scoping rule forbids.
    def recruiter_for(co):
        slug = co["name"].lower().replace(" ", "").replace(".", "")
        user, _ = User.objects.get_or_create(
            email=f"hiring@{slug}.com",
            defaults={
                "username": f"{slug}_recruiter",
                "is_recruiter": True,
                "first_name": co["name"],
                "last_name": "Talent",
            },
        )
        # Always reset the seed password (not just on first creation), so
        # re-running the seed keeps the documented credentials working.
        user.set_password("password123")
        user.save()
        return user

    for co in companies_data:
        company, created = Company.objects.get_or_create(
            name=co["name"],
            defaults={
                "description": co["description"],
                "industry": co["industry"],
                "size": co["size"],
                "website": co["website"],
                "location": co["location"],
            },
        )

        recruiter_user = recruiter_for(co)
        profile, _ = RecruiterProfile.objects.get_or_create(
            user=recruiter_user,
            defaults={"company": company, "designation": "Senior University Recruiter"},
        )
        # get_or_create only sets defaults on insert; an existing profile from
        # an earlier seed could still point at the wrong company.
        if profile.company_id != company.id:
            profile.company = company
            profile.save(update_fields=["company"])

        # 4. Create Real Jobs for each company
        job_titles = [
            ("Software Engineer", "Software Engineering"),
            ("Data Scientist", "Data Science"),
            ("Product Manager", "Product Management"),
            ("UX Designer", "Design"),
            ("Site Reliability Engineer", "DevOps"),
        ]

        for title, cat_name in job_titles:
            job_type = random.choice(
                ["Full-time", "Part-time", "Remote", "On-site"]
            )
            job = Job.objects.create(
                title=f"{title} at {co['name']}",
                company=company,
                recruiter=recruiter_user,
                description=f"Join the {co['name']} team as a {title}. Work on world-class projects and solve complex problems.",
                requirements="Bachelor's degree in CS or equivalent experience. Strong problem-solving skills.",
                location=("Remote" if job_type == "Remote" else co["location"]),
                salary=f"${random.randint(120, 180)}k - ${random.randint(190, 250)}k",
                job_type=job_type,
                category=categories_objs[cat_name],
                experience_required="2-5 years",
                deadline=date.today() + timedelta(days=random.randint(30, 90)),
                openings=random.randint(1, 10),
            )
            job.skills_required.set(random.sample(skills, 3))
            job.preferred_skills.set(random.sample(skills, 2))

        # 5. Create Real Internships for each company
        intern_titles = [
            ("Software Engineering Intern", "Software Engineering"),
            ("Product Design Intern", "Design"),
            ("Data Analytics Intern", "Data Science"),
        ]

        for title, cat_name in intern_titles:
            internship_type = random.choice(
                ["Full-time", "Part-time", "Remote", "On-site"]
            )
            internship = Internship.objects.create(
                title=f"{title} Summer 2026",
                company=company,
                recruiter=recruiter_user,
                description=f"12-week summer internship program at {co['name']}. You will be paired with a mentor and work on real production code.",
                requirements="Currently enrolled in a Bachelor's or Master's program in Computer Science or a related field.",
                location=("Remote" if internship_type == "Remote" else co["location"]),
                stipend=f"${random.randint(6000, 9000)}/month",
                duration="3 months",
                internship_type=internship_type,
                category=categories_objs[cat_name],
                deadline=date.today() + timedelta(days=random.randint(15, 45)),
                openings=random.randint(5, 20),
            )
            internship.skills_required.set(random.sample(skills, 2))
            internship.preferred_skills.set(random.sample(skills, 1))

    print(
        f"Successfully seeded {len(companies_data)} real companies with their jobs and internships."
    )


if __name__ == "__main__":
    clear_data()
    seed_data()
