"""
Seed script for career paths, interview questions, and skill resources.
Run with: python manage.py shell < careers/seed_careers.py
"""

import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "portal.settings")
django.setup()

from careers.models import (  # noqa: E402
    CareerPath,
    CareerPathMilestone,
    InterviewQuestion,
    SkillResource,
)
from jobs.models import Skill  # noqa: E402


def seed_career_paths():
    """Create career paths with milestones."""

    paths_data = [
        {
            "name": "Frontend Developer",
            "description": "Build beautiful, interactive user interfaces and web applications.",
            "icon": "fa-laptop-code",
            "color": "#2563eb",
            "avg_salary_min": 70,
            "avg_salary_max": 150,
            "growth_outlook": "Growing 25% annually",
            "milestones": [
                {
                    "title": "Junior Frontend Developer",
                    "level": "entry",
                    "description": "Build UI components and implement designs with modern frameworks.",
                    "order": 1,
                    "skills": ["HTML", "CSS", "JavaScript", "React"],
                    "experience_years": "0-2 years",
                    "salary_range": "$60K - $85K",
                },
                {
                    "title": "Frontend Developer",
                    "level": "mid",
                    "description": "Own feature development, optimize performance, and mentor juniors.",
                    "order": 2,
                    "skills": [
                        "React",
                        "TypeScript",
                        "CSS",
                        "JavaScript",
                        "REST APIs",
                        "Git",
                    ],
                    "experience_years": "2-5 years",
                    "salary_range": "$85K - $120K",
                },
                {
                    "title": "Senior Frontend Developer",
                    "level": "senior",
                    "description": "Architect frontend systems, lead UI initiatives, drive best practices.",
                    "order": 3,
                    "skills": [
                        "React",
                        "TypeScript",
                        "Node.js",
                        "System Design",
                        "Testing",
                        "GraphQL",
                    ],
                    "experience_years": "5-8 years",
                    "salary_range": "$120K - $160K",
                },
                {
                    "title": "Frontend Lead",
                    "level": "lead",
                    "description": "Lead frontend teams, define technical roadmap, influence product direction.",
                    "order": 4,
                    "skills": [
                        "React",
                        "TypeScript",
                        "System Design",
                        "Leadership",
                        "DevOps",
                        "Architecture",
                    ],
                    "experience_years": "8+ years",
                    "salary_range": "$160K - $200K+",
                },
            ],
        },
        {
            "name": "Backend Developer",
            "description": "Design and build scalable server-side systems and APIs.",
            "icon": "fa-server",
            "color": "#7c3aed",
            "avg_salary_min": 80,
            "avg_salary_max": 180,
            "growth_outlook": "Growing 20% annually",
            "milestones": [
                {
                    "title": "Junior Backend Developer",
                    "level": "entry",
                    "description": "Build APIs, write database queries, and implement business logic.",
                    "order": 1,
                    "skills": ["Python", "Django", "SQL", "REST APIs", "Git"],
                    "experience_years": "0-2 years",
                    "salary_range": "$70K - $90K",
                },
                {
                    "title": "Backend Developer",
                    "level": "mid",
                    "description": "Design scalable services, optimize database performance, implement security.",
                    "order": 2,
                    "skills": [
                        "Python",
                        "Django",
                        "SQL",
                        "PostgreSQL",
                        "Docker",
                        "Redis",
                        "AWS",
                    ],
                    "experience_years": "2-5 years",
                    "salary_range": "$90K - $130K",
                },
                {
                    "title": "Senior Backend Developer",
                    "level": "senior",
                    "description": "Architect microservices, lead backend initiatives, ensure reliability.",
                    "order": 3,
                    "skills": [
                        "Python",
                        "System Design",
                        "Microservices",
                        "AWS",
                        "Docker",
                        "Kubernetes",
                        "CI/CD",
                    ],
                    "experience_years": "5-8 years",
                    "salary_range": "$130K - $170K",
                },
                {
                    "title": "Backend Architect",
                    "level": "principal",
                    "description": "Define technical strategy, design systems at scale, mentor organization.",
                    "order": 4,
                    "skills": [
                        "System Design",
                        "Microservices",
                        "Cloud Architecture",
                        "Leadership",
                        "Distributed Systems",
                    ],
                    "experience_years": "8+ years",
                    "salary_range": "$170K - $220K+",
                },
            ],
        },
        {
            "name": "Data Scientist",
            "description": "Extract insights from data and build ML models to solve business problems.",
            "icon": "fa-chart-bar",
            "color": "#059669",
            "avg_salary_min": 90,
            "avg_salary_max": 200,
            "growth_outlook": "Growing 35% annually",
            "milestones": [
                {
                    "title": "Junior Data Scientist",
                    "level": "entry",
                    "description": "Analyze data, build basic models, create visualizations.",
                    "order": 1,
                    "skills": [
                        "Python",
                        "SQL",
                        "Machine Learning",
                        "Statistics",
                        "Data Visualization",
                    ],
                    "experience_years": "0-2 years",
                    "salary_range": "$80K - $100K",
                },
                {
                    "title": "Data Scientist",
                    "level": "mid",
                    "description": "Own ML projects, design experiments, deploy models to production.",
                    "order": 2,
                    "skills": [
                        "Python",
                        "Machine Learning",
                        "Deep Learning",
                        "SQL",
                        "TensorFlow",
                        "PyTorch",
                        "Docker",
                    ],
                    "experience_years": "2-5 years",
                    "salary_range": "$100K - $140K",
                },
                {
                    "title": "Senior Data Scientist",
                    "level": "senior",
                    "description": "Lead ML strategy, mentor teams, drive research initiatives.",
                    "order": 3,
                    "skills": [
                        "Machine Learning",
                        "Deep Learning",
                        "MLOps",
                        "AWS",
                        "NLP",
                        "Computer Vision",
                        "Leadership",
                    ],
                    "experience_years": "5-8 years",
                    "salary_range": "$140K - $180K",
                },
                {
                    "title": "Principal Data Scientist",
                    "level": "principal",
                    "description": "Define AI/ML vision, lead research, influence industry standards.",
                    "order": 4,
                    "skills": [
                        "Deep Learning",
                        "MLOps",
                        "AI Research",
                        "Leadership",
                        "Distributed Systems",
                    ],
                    "experience_years": "8+ years",
                    "salary_range": "$180K - $250K+",
                },
            ],
        },
        {
            "name": "DevOps Engineer",
            "description": "Build and maintain infrastructure for reliable, scalable applications.",
            "icon": "fa-cloud",
            "color": "#dc2626",
            "avg_salary_min": 85,
            "avg_salary_max": 175,
            "growth_outlook": "Growing 30% annually",
            "milestones": [
                {
                    "title": "Junior DevOps Engineer",
                    "level": "entry",
                    "description": "Manage CI/CD pipelines, monitor systems, automate deployments.",
                    "order": 1,
                    "skills": ["Linux", "Docker", "Git", "CI/CD", "AWS", "Bash"],
                    "experience_years": "0-2 years",
                    "salary_range": "$75K - $95K",
                },
                {
                    "title": "DevOps Engineer",
                    "level": "mid",
                    "description": "Design infrastructure, implement monitoring, optimize costs.",
                    "order": 2,
                    "skills": [
                        "Docker",
                        "Kubernetes",
                        "AWS",
                        "Terraform",
                        "CI/CD",
                        "Monitoring",
                        "Linux",
                    ],
                    "experience_years": "2-5 years",
                    "salary_range": "$95K - $135K",
                },
                {
                    "title": "Senior DevOps Engineer",
                    "level": "senior",
                    "description": "Architect cloud infrastructure, lead reliability initiatives.",
                    "order": 3,
                    "skills": [
                        "Kubernetes",
                        "AWS",
                        "Terraform",
                        "Ansible",
                        "System Design",
                        "Security",
                        "SRE",
                    ],
                    "experience_years": "5-8 years",
                    "salary_range": "$135K - $175K",
                },
                {
                    "title": "DevOps Architect",
                    "level": "principal",
                    "description": "Define infrastructure strategy, drive cloud adoption, ensure reliability.",
                    "order": 4,
                    "skills": [
                        "Cloud Architecture",
                        "Kubernetes",
                        "System Design",
                        "Security",
                        "Leadership",
                        "SRE",
                    ],
                    "experience_years": "8+ years",
                    "salary_range": "$175K - $220K+",
                },
            ],
        },
        {
            "name": "Full-Stack Developer",
            "description": "Build end-to-end features across both frontend and backend systems.",
            "icon": "fa-cubes",
            "color": "#0891b2",
            "avg_salary_min": 80,
            "avg_salary_max": 170,
            "growth_outlook": "Growing 22% annually",
            "milestones": [
                {
                    "title": "Junior Full-Stack Developer",
                    "level": "entry",
                    "description": "Build features across the stack with guidance from senior developers.",
                    "order": 1,
                    "skills": [
                        "HTML",
                        "CSS",
                        "JavaScript",
                        "Python",
                        "Django",
                        "SQL",
                        "Git",
                    ],
                    "experience_years": "0-2 years",
                    "salary_range": "$70K - $90K",
                },
                {
                    "title": "Full-Stack Developer",
                    "level": "mid",
                    "description": "Own features end-to-end, optimize performance, ensure quality.",
                    "order": 2,
                    "skills": [
                        "React",
                        "TypeScript",
                        "Python",
                        "Django",
                        "PostgreSQL",
                        "Docker",
                        "AWS",
                        "REST APIs",
                    ],
                    "experience_years": "2-5 years",
                    "salary_range": "$90K - $130K",
                },
                {
                    "title": "Senior Full-Stack Developer",
                    "level": "senior",
                    "description": "Architect systems, lead projects, mentor developers across the stack.",
                    "order": 3,
                    "skills": [
                        "React",
                        "TypeScript",
                        "Python",
                        "System Design",
                        "AWS",
                        "Docker",
                        "Testing",
                        "Leadership",
                    ],
                    "experience_years": "5-8 years",
                    "salary_range": "$130K - $170K",
                },
                {
                    "title": "Full-Stack Lead",
                    "level": "lead",
                    "description": "Lead development teams, define technical strategy, drive product delivery.",
                    "order": 4,
                    "skills": [
                        "System Design",
                        "Architecture",
                        "Leadership",
                        "DevOps",
                        "Project Management",
                    ],
                    "experience_years": "8+ years",
                    "salary_range": "$170K - $210K+",
                },
            ],
        },
        {
            "name": "Mobile Developer",
            "description": "Create engaging mobile experiences for iOS and Android platforms.",
            "icon": "fa-mobile-alt",
            "color": "#d97706",
            "avg_salary_min": 75,
            "avg_salary_max": 160,
            "growth_outlook": "Growing 18% annually",
            "milestones": [
                {
                    "title": "Junior Mobile Developer",
                    "level": "entry",
                    "description": "Build mobile UI components and integrate APIs.",
                    "order": 1,
                    "skills": ["JavaScript", "React Native", "CSS", "REST APIs", "Git"],
                    "experience_years": "0-2 years",
                    "salary_range": "$65K - $85K",
                },
                {
                    "title": "Mobile Developer",
                    "level": "mid",
                    "description": "Own feature development, optimize app performance, publish apps.",
                    "order": 2,
                    "skills": [
                        "React Native",
                        "TypeScript",
                        "iOS",
                        "Android",
                        "REST APIs",
                        "Redux",
                        "Testing",
                    ],
                    "experience_years": "2-5 years",
                    "salary_range": "$85K - $120K",
                },
                {
                    "title": "Senior Mobile Developer",
                    "level": "senior",
                    "description": "Architect mobile apps, lead platform initiatives, mentor developers.",
                    "order": 3,
                    "skills": [
                        "React Native",
                        "Swift",
                        "Kotlin",
                        "System Design",
                        "CI/CD",
                        "App Architecture",
                    ],
                    "experience_years": "5-8 years",
                    "salary_range": "$120K - $160K",
                },
                {
                    "title": "Mobile Lead",
                    "level": "lead",
                    "description": "Define mobile strategy, lead teams, drive cross-platform innovation.",
                    "order": 4,
                    "skills": [
                        "App Architecture",
                        "Leadership",
                        "System Design",
                        "DevOps",
                        "Product Strategy",
                    ],
                    "experience_years": "8+ years",
                    "salary_range": "$160K - $200K+",
                },
            ],
        },
    ]

    for path_data in paths_data:
        milestones = path_data.pop("milestones")
        path, created = CareerPath.objects.get_or_create(
            name=path_data["name"], defaults=path_data
        )
        if created:
            print(f"  Created career path: {path.name}")
        else:
            print(f"  Career path already exists: {path.name}")

        for i, m in enumerate(milestones):
            skill_names = m.pop("skills")
            milestone, created = CareerPathMilestone.objects.get_or_create(
                career_path=path, title=m["title"], defaults={**m, "order": i + 1}
            )
            if created:
                for s_name in skill_names:
                    skill, _ = Skill.objects.get_or_create(name=s_name)
                    milestone.skills_required.add(skill)
                print(f"    Created milestone: {milestone.title}")


def seed_interview_questions():
    """Create interview questions for skills."""

    questions_data = [
        # Python Questions
        {
            "skill_name": "Python",
            "questions": [
                {
                    "question": "What is the difference between a list and a tuple in Python?",
                    "answer": "Lists are mutable (can be modified after creation), while tuples are immutable. Lists use square brackets [], tuples use parentheses (). Tuples are faster and can be used as dictionary keys since they are hashable.",
                    "difficulty": "beginner",
                },
                {
                    "question": "Explain Python decorators and provide a use case.",
                    "answer": "Decorators are functions that modify the behavior of other functions without changing their code. They use the @ syntax. Common use cases: logging, access control, timing functions, caching.",
                    "difficulty": "intermediate",
                },
                {
                    "question": "What is the Global Interpreter Lock (GIL) and how does it affect multithreading in Python?",
                    "answer": "The GIL is a mutex that protects access to Python objects, preventing multiple threads from executing Python bytecode simultaneously. This means CPU-bound threads don't benefit from multi-core parallelism. Solutions: use multiprocessing for CPU-bound tasks, asyncio for I/O-bound tasks, or C extensions that release the GIL.",
                    "difficulty": "advanced",
                },
            ],
        },
        # Django Questions
        {
            "skill_name": "Django",
            "questions": [
                {
                    "question": "What is the difference between a Django Project and a Django App?",
                    "answer": "A Django project is the entire web application (settings, URLs, WSGI config). An app is a self-contained module that handles a specific functionality (e.g., blog, payments). A project can contain multiple apps, and apps can be reused across projects.",
                    "difficulty": "beginner",
                },
                {
                    "question": "Explain Django's ORM and how you would optimize a slow query.",
                    "answer": "Django ORM provides a high-level abstraction for database operations. For optimization: use select_related() and prefetch_related() to reduce queries, use only()/defer() to limit fields, add database indexes, use annotate() instead of Python-side aggregation, and use explain() to analyze query plans.",
                    "difficulty": "intermediate",
                },
                {
                    "question": "How would you design a scalable real-time notification system in Django?",
                    "answer": "Use Django Channels with WebSocket connections. Architecture: 1) Channel layer (Redis) for message brokering, 2) Consumer class handling WebSocket lifecycle, 3) post_save signals on the Notification model to trigger real-time updates, 4) Group-based routing to send notifications to specific users, 5) Async workers for handling high-volume notifications.",
                    "difficulty": "advanced",
                },
            ],
        },
        # React Questions
        {
            "skill_name": "React",
            "questions": [
                {
                    "question": "What is the difference between props and state in React?",
                    "answer": "Props are read-only data passed from parent to child components. State is mutable data managed within a component. Changing props requires parent re-render, while setState/useState trigger a re-render of the component and its children.",
                    "difficulty": "beginner",
                },
                {
                    "question": "Explain the useEffect hook and its dependency array.",
                    "answer": "useEffect runs side effects in function components. The dependency array controls when the effect runs: empty [] runs once on mount, [dep] runs when dep changes, no array runs after every render. Cleanup function returned from useEffect runs on unmount or before re-execution.",
                    "difficulty": "intermediate",
                },
                {
                    "question": "What are React hooks and what rules must you follow when using them?",
                    "answer": 'Hooks are functions that let you use state and lifecycle features in functional components. Rules: 1) Only call hooks at the top level (not inside loops, conditions, or nested functions), 2) Only call hooks from React function components or custom hooks, 3) Hook names must start with "use".',
                    "difficulty": "intermediate",
                },
            ],
        },
        # SQL Questions
        {
            "skill_name": "SQL",
            "questions": [
                {
                    "question": "What is the difference between INNER JOIN and LEFT JOIN?",
                    "answer": "INNER JOIN returns only rows with matching values in both tables. LEFT JOIN returns all rows from the left table and matching rows from the right table, with NULLs where no match exists.",
                    "difficulty": "beginner",
                },
                {
                    "question": "Explain database indexing and when you should use it.",
                    "answer": "Indexes are data structures that speed up data retrieval at the cost of slower writes. Use indexes on columns used in WHERE clauses, JOIN conditions, and ORDER BY. Avoid indexing columns with low cardinality (e.g., boolean) or frequently updated columns.",
                    "difficulty": "intermediate",
                },
                {
                    "question": "How would you optimize a query that joins 5 tables and returns millions of rows?",
                    "answer": "1) Ensure proper indexes on join columns and WHERE filters, 2) Use EXPLAIN ANALYZE to identify bottlenecks, 3) Consider denormalization for read-heavy workloads, 4) Use pagination/limits instead of full scans, 5) Implement materialized views for complex aggregations, 6) Consider partitioning large tables, 7) Use query caching with Redis.",
                    "difficulty": "advanced",
                },
            ],
        },
        # JavaScript Questions
        {
            "skill_name": "JavaScript",
            "questions": [
                {
                    "question": "What is the difference between var, let, and const?",
                    "answer": "var is function-scoped and hoisted. let and const are block-scoped. const cannot be reassigned (but objects can be mutated). let can be reassigned. var allows redeclaration in the same scope, let and const do not.",
                    "difficulty": "beginner",
                },
                {
                    "question": "Explain closures in JavaScript with an example.",
                    "answer": "A closure is a function that retains access to variables from its outer scope even after the outer function has returned. Example: function counter() { let count = 0; return function() { return ++count; } } const c = counter(); c(); // 1, c(); // 2",
                    "difficulty": "intermediate",
                },
                {
                    "question": "Explain the event loop and microtasks vs macrotasks.",
                    "answer": "The event loop continuously checks the call stack and task queues. Microtasks (Promises, queueMicrotask) have priority over macrotasks (setTimeout, setInterval, I/O). After each macrotask, the event loop processes all microtasks before the next macrotask.",
                    "difficulty": "advanced",
                },
            ],
        },
        # TypeScript Questions
        {
            "skill_name": "TypeScript",
            "questions": [
                {
                    "question": "What are the benefits of TypeScript over JavaScript?",
                    "answer": "1) Static typing catches errors at compile time, 2) Better IDE support with autocomplete and refactoring, 3) Self-documenting code through type annotations, 4) Interfaces and generics for reusable abstractions, 5) Better team collaboration with explicit contracts.",
                    "difficulty": "beginner",
                },
                {
                    "question": "Explain the difference between interfaces and type aliases in TypeScript.",
                    "answer": "Interfaces can be extended (extended or merged), while type aliases use intersections (&). Interfaces are preferred for object shapes, type aliases for unions, tuples, and primitives. Interfaces can be augmented (declaration merging), types cannot.",
                    "difficulty": "intermediate",
                },
            ],
        },
        # Docker Questions
        {
            "skill_name": "Docker",
            "questions": [
                {
                    "question": "What is the difference between a Docker image and a container?",
                    "answer": "An image is a read-only template with instructions for creating a container. A container is a runnable instance of an image. Images are built (via Dockerfile), containers are started (via docker run). Multiple containers can be created from the same image.",
                    "difficulty": "beginner",
                },
                {
                    "question": "Explain Docker multi-stage builds and their benefits.",
                    "answer": "Multi-stage builds use multiple FROM statements in a Dockerfile to separate build-time and runtime dependencies. Benefits: smaller final images, improved security (no build tools in production), faster deployment, separated concerns. Common pattern: build with all SDKs, then copy only the artifact to a minimal runtime image.",
                    "difficulty": "intermediate",
                },
            ],
        },
        # Leadership Questions (Behavioral)
        {
            "skill_name": "HTML",
            "questions": [
                {
                    "question": "Tell me about a time you had to lead a project with conflicting stakeholder requirements.",
                    "answer": "Use the STAR method: Situation - describe the context, Task - your responsibility, Action - specific steps you took (facilitate meetings, prioritize requirements, propose compromises), Result - successful outcome. Emphasize communication, prioritization, and compromise skills.",
                    "difficulty": "advanced",
                    "is_behavioral": True,
                },
                {
                    "question": "Describe a situation where you had to learn a new technology quickly to deliver a project.",
                    "answer": "Use STAR: Situation - project requirement for unfamiliar tech, Task - need to deliver on time, Action - structured learning approach (tutorials, docs, pair programming, POC), Result - successfully delivered. Show adaptability and learning methodology.",
                    "difficulty": "advanced",
                    "is_behavioral": True,
                },
            ],
        },
        # System Design Questions
        {
            "skill_name": "CSS",
            "questions": [
                {
                    "question": "How would you design a URL shortening service like TinyURL?",
                    "answer": "1) Requirements: generate unique short URLs, handle redirects, analytics. 2) API: POST /shorten returns short URL, GET /{id} redirects. 3) Database: key-value store for mappings, counter for unique IDs. 4) Scale: use base62 encoding, distributed counters (ZooKeeper), caching with Redis, CDN for popular URLs.",
                    "difficulty": "advanced",
                },
            ],
        },
    ]

    for q_data in questions_data:
        skill, _ = Skill.objects.get_or_create(name=q_data["skill_name"])
        for q in q_data["questions"]:
            is_behavioral = q.pop("is_behavioral", False)
            question, created = InterviewQuestion.objects.get_or_create(
                skill=skill,
                question=q["question"],
                defaults={
                    "answer": q["answer"],
                    "difficulty": q["difficulty"],
                    "is_behavioral": is_behavioral,
                },
            )
            if created:
                print(
                    f"  Created question: [{q['difficulty']}] {q['question'][:50]}..."
                )


def seed_skill_resources():
    """Create learning resources for skills."""

    resources_data = [
        # Python resources
        {
            "skill_name": "Python",
            "resources": [
                {
                    "title": "Python for Everybody",
                    "url": "https://www.py4e.com/",
                    "resource_type": "course",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Real Python Tutorials",
                    "url": "https://realpython.com/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Python Crash Course",
                    "url": "https://nostarch.com/pythoncrashcourse2e",
                    "resource_type": "book",
                    "difficulty": "beginner",
                    "is_free": False,
                },
                {
                    "title": "Effective Python",
                    "url": "https://effectivepython.com/",
                    "resource_type": "book",
                    "difficulty": "intermediate",
                    "is_free": False,
                },
                {
                    "title": "Fluent Python",
                    "url": "https://www.oreilly.com/library/view/fluent-python/9781491946237/",
                    "resource_type": "book",
                    "difficulty": "advanced",
                    "is_free": False,
                },
            ],
        },
        # Django resources
        {
            "skill_name": "Django",
            "resources": [
                {
                    "title": "Django Official Tutorial",
                    "url": "https://docs.djangoproject.com/en/5.2/intro/tutorial01/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Django for Beginners",
                    "url": "https://djangoforbeginners.com/",
                    "resource_type": "book",
                    "difficulty": "beginner",
                    "is_free": False,
                },
                {
                    "title": "Django REST Framework Tutorial",
                    "url": "https://www.django-rest-framework.org/tutorial/1-serialization/",
                    "resource_type": "tutorial",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
                {
                    "title": "Two Scoops of Django",
                    "url": "https://www.feldroy.com/books/two-scoops-of-django-3-x",
                    "resource_type": "book",
                    "difficulty": "advanced",
                    "is_free": False,
                },
            ],
        },
        # React resources
        {
            "skill_name": "React",
            "resources": [
                {
                    "title": "React Official Tutorial",
                    "url": "https://react.dev/learn",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Epic React by Kent C. Dodds",
                    "url": "https://epicreact.dev/",
                    "resource_type": "course",
                    "difficulty": "intermediate",
                    "is_free": False,
                },
                {
                    "title": "React TypeScript Cheatsheet",
                    "url": "https://react-typescript-cheatsheet.netlify.app/",
                    "resource_type": "documentation",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
                {
                    "title": "Full Stack Open",
                    "url": "https://fullstackopen.com/en/",
                    "resource_type": "course",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
            ],
        },
        # SQL resources
        {
            "skill_name": "SQL",
            "resources": [
                {
                    "title": "SQLBolt - Interactive SQL Tutorial",
                    "url": "https://sqlbolt.com/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "PostgreSQL Tutorial",
                    "url": "https://www.postgresqltutorial.com/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Use The Index, Luke",
                    "url": "https://use-the-index-luke.com/",
                    "resource_type": "book",
                    "difficulty": "advanced",
                    "is_free": True,
                },
            ],
        },
        # JavaScript resources
        {
            "skill_name": "JavaScript",
            "resources": [
                {
                    "title": "JavaScript.info",
                    "url": "https://javascript.info/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "You Don't Know JS Yet",
                    "url": "https://github.com/getify/You-Dont-Know-JS",
                    "resource_type": "book",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
                {
                    "title": "MDN Web Docs - JavaScript",
                    "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
                    "resource_type": "documentation",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "JavaScript: The Good Parts",
                    "url": "https://www.oreilly.com/library/view/javascript-the-good/9780596517748/",
                    "resource_type": "book",
                    "difficulty": "advanced",
                    "is_free": False,
                },
            ],
        },
        # TypeScript resources
        {
            "skill_name": "TypeScript",
            "resources": [
                {
                    "title": "TypeScript Handbook",
                    "url": "https://www.typescriptlang.org/docs/handbook/intro.html",
                    "resource_type": "documentation",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "TypeScript Deep Dive",
                    "url": "https://basarat.gitbook.io/typescript/",
                    "resource_type": "book",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
                {
                    "title": "Total TypeScript",
                    "url": "https://www.totaltypescript.com/",
                    "resource_type": "course",
                    "difficulty": "intermediate",
                    "is_free": False,
                },
            ],
        },
        # Docker resources
        {
            "skill_name": "Docker",
            "resources": [
                {
                    "title": "Docker Get Started Guide",
                    "url": "https://docs.docker.com/get-started/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Docker Deep Dive",
                    "url": "https://www.amazon.com/Docker-Deep-Dive-Nigel-Poulton/dp/1521822808",
                    "resource_type": "book",
                    "difficulty": "intermediate",
                    "is_free": False,
                },
                {
                    "title": "Play with Docker",
                    "url": "https://labs.play-with-docker.com/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
            ],
        },
        # AWS resources
        {
            "skill_name": "AWS",
            "resources": [
                {
                    "title": "AWS Free Tier",
                    "url": "https://aws.amazon.com/free/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "AWS Certified Solutions Architect Study Guide",
                    "url": "https://www.amazon.com/Certified-Solutions-Architect-Official-Study/dp/1119504213",
                    "resource_type": "book",
                    "difficulty": "intermediate",
                    "is_free": False,
                },
                {
                    "title": "A Cloud Guru",
                    "url": "https://acloudguru.com/",
                    "resource_type": "course",
                    "difficulty": "intermediate",
                    "is_free": False,
                },
            ],
        },
        # Git resources
        {
            "skill_name": "Git",
            "resources": [
                {
                    "title": "GitHub Learning Lab",
                    "url": "https://lab.github.com/",
                    "resource_type": "course",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Pro Git Book",
                    "url": "https://git-scm.com/book/en/v2",
                    "resource_type": "book",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Learn Git Branching",
                    "url": "https://learngitbranching.js.org/",
                    "resource_type": "tutorial",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
            ],
        },
        # Machine Learning resources
        {
            "skill_name": "Machine Learning",
            "resources": [
                {
                    "title": "Andrew Ng's Machine Learning Course",
                    "url": "https://www.coursera.org/learn/machine-learning",
                    "resource_type": "course",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Fast.ai Practical Deep Learning",
                    "url": "https://course.fast.ai/",
                    "resource_type": "course",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
                {
                    "title": "Scikit-learn Documentation",
                    "url": "https://scikit-learn.org/stable/tutorial/index.html",
                    "resource_type": "documentation",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
                {
                    "title": "Pattern Recognition and Machine Learning",
                    "url": "https://www.microsoft.com/en-us/research/uploads/prod/2006/01/Bishop-Pattern-Recognition-and-Machine-Learning-2006.pdf",
                    "resource_type": "book",
                    "difficulty": "advanced",
                    "is_free": True,
                },
            ],
        },
        # Linux resources
        {
            "skill_name": "Linux",
            "resources": [
                {
                    "title": "Linux Journey",
                    "url": "https://linuxjourney.com/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "The Linux Command Line",
                    "url": "https://linuxcommand.org/tlcl.php",
                    "resource_type": "book",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Linux Kernel Documentation",
                    "url": "https://www.kernel.org/doc/html/latest/",
                    "resource_type": "documentation",
                    "difficulty": "advanced",
                    "is_free": True,
                },
            ],
        },
        # PostgreSQL resources
        {
            "skill_name": "PostgreSQL",
            "resources": [
                {
                    "title": "PostgreSQL Official Docs",
                    "url": "https://www.postgresql.org/docs/",
                    "resource_type": "documentation",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "PG Exercises",
                    "url": "https://pgexercises.com/",
                    "resource_type": "tutorial",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
                {
                    "title": "High Performance PostgreSQL",
                    "url": "https://www.amazon.com/High-Performance-PostgreSQL-Joshua-Hamilton/dp/1800560978",
                    "resource_type": "book",
                    "difficulty": "advanced",
                    "is_free": False,
                },
            ],
        },
        # Node.js resources
        {
            "skill_name": "Node.js",
            "resources": [
                {
                    "title": "Node.js Official Docs",
                    "url": "https://nodejs.org/en/docs/",
                    "resource_type": "documentation",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Node.js Design Patterns",
                    "url": "https://www.nodejsdesignpatterns.com/",
                    "resource_type": "book",
                    "difficulty": "advanced",
                    "is_free": False,
                },
                {
                    "title": "The Odin Project - NodeJS",
                    "url": "https://www.theodinproject.com/paths/full-stack-javascript",
                    "resource_type": "course",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
            ],
        },
        # --- High-demand skills that previously had no resources at all, so
        # --- the gap analysis recommended them with nothing to act on.
        {
            "skill_name": "Kubernetes",
            "resources": [
                {
                    "title": "Kubernetes Basics (Official Tutorial)",
                    "url": "https://kubernetes.io/docs/tutorials/kubernetes-basics/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Kubernetes Documentation",
                    "url": "https://kubernetes.io/docs/home/",
                    "resource_type": "documentation",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
                {
                    "title": "Kubernetes Up & Running",
                    "url": "https://www.oreilly.com/library/view/kubernetes-up-and/9781098110192/",
                    "resource_type": "book",
                    "difficulty": "advanced",
                    "is_free": False,
                },
            ],
        },
        {
            "skill_name": "Java",
            "resources": [
                {
                    "title": "Java Programming MOOC (University of Helsinki)",
                    "url": "https://java-programming.mooc.fi/",
                    "resource_type": "course",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "The Java Tutorials (Oracle)",
                    "url": "https://docs.oracle.com/javase/tutorial/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Effective Java",
                    "url": "https://www.oreilly.com/library/view/effective-java-3rd/9780134686097/",
                    "resource_type": "book",
                    "difficulty": "advanced",
                    "is_free": False,
                },
            ],
        },
        {
            "skill_name": "Swift",
            "resources": [
                {
                    "title": "Hacking with Swift",
                    "url": "https://www.hackingwithswift.com/",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "SwiftUI Tutorials (Apple)",
                    "url": "https://developer.apple.com/tutorials/swiftui",
                    "resource_type": "course",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "The Swift Programming Language",
                    "url": "https://docs.swift.org/swift-book/",
                    "resource_type": "documentation",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
            ],
        },
        {
            "skill_name": "Kotlin",
            "resources": [
                {
                    "title": "Kotlin Koans",
                    "url": "https://play.kotlinlang.org/koans/overview",
                    "resource_type": "tutorial",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Android Basics with Compose",
                    "url": "https://developer.android.com/courses/android-basics-compose/course",
                    "resource_type": "course",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Kotlin Documentation",
                    "url": "https://kotlinlang.org/docs/home.html",
                    "resource_type": "documentation",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
            ],
        },
        {
            "skill_name": "UI/UX Design",
            "resources": [
                {
                    "title": "Laws of UX",
                    "url": "https://lawsofux.com/",
                    "resource_type": "article",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Material Design Guidelines",
                    "url": "https://m3.material.io/",
                    "resource_type": "documentation",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Google UX Design Certificate",
                    "url": "https://www.coursera.org/professional-certificates/google-ux-design",
                    "resource_type": "course",
                    "difficulty": "intermediate",
                    "is_free": False,
                },
                {
                    "title": "Refactoring UI",
                    "url": "https://www.refactoringui.com/",
                    "resource_type": "book",
                    "difficulty": "intermediate",
                    "is_free": False,
                },
            ],
        },
        {
            "skill_name": "Data Analysis",
            "resources": [
                {
                    "title": "Kaggle Learn: Pandas",
                    "url": "https://www.kaggle.com/learn/pandas",
                    "resource_type": "course",
                    "difficulty": "beginner",
                    "is_free": True,
                },
                {
                    "title": "Python for Data Analysis (3rd ed.)",
                    "url": "https://wesmckinney.com/book/",
                    "resource_type": "book",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
                {
                    "title": "pandas Documentation",
                    "url": "https://pandas.pydata.org/docs/",
                    "resource_type": "documentation",
                    "difficulty": "intermediate",
                    "is_free": True,
                },
            ],
        },
    ]

    for r_data in resources_data:
        skill, _ = Skill.objects.get_or_create(name=r_data["skill_name"])
        for res in r_data["resources"]:
            resource, created = SkillResource.objects.get_or_create(
                skill=skill, title=res["title"], defaults=res
            )
            if created:
                print(f"  Created resource: {resource.title}")


def run():
    print("Seeding career paths...")
    seed_career_paths()
    print("\nSeeding interview questions...")
    seed_interview_questions()
    print("\nSeeding learning resources...")
    seed_skill_resources()
    print("\nSeed completed successfully!")


# Entry point for running via `python manage.py shell < careers/seed_careers.py`
# or `python manage.py shell -c "exec(open('careers/seed_careers.py').read())"`
run()
