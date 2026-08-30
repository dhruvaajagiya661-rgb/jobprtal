import requests
from .models import StudentProfile


class GitHubService:
    @staticmethod
    def sync_github_data(profile_id):
        """
        Fetches public repository data and languages for a student to verify skills.
        """
        try:
            profile = StudentProfile.objects.get(id=profile_id)
            if not profile.github_username:
                return False

            url = f"https://api.github.com/users/{profile.github_username}/repos"
            response = requests.get(url, timeout=10)

            if response.status_code == 200:
                repos = response.json()
                languages = {}
                for repo in repos:
                    lang = repo.get("language")
                    if lang:
                        languages[lang] = languages.get(lang, 0) + 1

                profile.verified_github_data = {
                    "public_repos": len(repos),
                    "top_languages": sorted(
                        languages.items(), key=lambda x: x[1], reverse=True
                    )[:5],
                    "updated_at": str(requests.utils.datetime.datetime.now()),
                }
                profile.save()
                return True
        except Exception as e:
            print(f"GitHub Sync Error: {e}")
            return False
        return False
