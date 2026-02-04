# Authentication & User Roles

## Login Method
- Email + Password
- Managed via Supabase Auth

## User Roles
- Admin
- Kurucu
- Müdür
- Personel
- Öğretmen
- Veli

## Authorization Principles
- Role-based page visibility
- Centralized permission management panel
- Permissions enforced in:
  - UI
  - Database (Supabase RLS)

## User Profile
Each authenticated user has a system profile containing:
- auth_user_id
- role
- name
- email
- active / passive status