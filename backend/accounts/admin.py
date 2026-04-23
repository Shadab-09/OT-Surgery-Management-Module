from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "role", "department", "is_active")
    list_filter = ("role", "department", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        ("Queue Module", {"fields": ("role", "phone", "department")}),
    )
