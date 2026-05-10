from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Fix: adds three fields that were expected in the DB but missing from models:
      - CCR.is_locked              (was causing null-constraint on course creation)
      - CCR.allow_cross_semester   (was referenced in old UI but never added)
      - StudentEnrolment.ese_eligible  (was causing null-constraint on enrolment)
    """

    dependencies = [
        ('core', '0005_user_must_change_password_studentenrolment_admin_override'),
    ]

    operations = [
        # ── CCR ───────────────────────────────────────────────────────────
        migrations.AddField(
            model_name='ccr',
            name='is_locked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='ccr',
            name='allow_cross_semester',
            field=models.BooleanField(
                default=False,
                help_text='Allow students from other semesters to enrol (e.g. OE courses).',
            ),
        ),
        # ── StudentEnrolment ──────────────────────────────────────────────
        migrations.AddField(
            model_name='studentenrolment',
            name='ese_eligible',
            field=models.BooleanField(
                default=True,
                help_text='Whether the student is eligible to sit the ESE for this course.',
            ),
        ),
    ]
