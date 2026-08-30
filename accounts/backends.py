"""
Authentication backend allowing login with either the username or the email.

The custom user model sets ``USERNAME_FIELD = "email"`` so Django's default
backend only authenticates against the email. This backend also accepts the
username, which is convenient when logging into the Django admin.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


class EmailOrUsernameModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        identifier = username or kwargs.get(UserModel.USERNAME_FIELD)
        if identifier is None or password is None:
            return None
        user = UserModel._default_manager.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()
        if user is None:
            # Run the default password hasher once to avoid timing leaks.
            UserModel().set_password(password)
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
