# Core Data Models

## Students
- id
- name
- parent_id
- branch_id
- teacher_id
- status

## Teachers
- id
- name
- branches[]
- salary_info
- sgk_info

## Branches
- id
- upper_branch_id
- name
- color_code

## Lessons
- id
- student_id
- teacher_id
- branch_id
- date
- duration

## Financial Records
- id
- type (income / expense)
- category_id
- amount
- date