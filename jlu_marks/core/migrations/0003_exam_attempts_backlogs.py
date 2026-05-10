"""
Migration 0003 — Exam attempts, backlogs, and exam statistics
─────────────────────────────────────────────────────────────
Changes
• result_sheet   — adds pass_status column + idx_result_pass_status index
• exam_attempt   — new table
• student_backlog — new table
• course_exam_stats — new table
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_remove_iacomponent_iacomponent_course_name_uniq_and_more'),
    ]

    operations = [

        # ── 1. result_sheet: add pass_status ─────────────────────────────────
        migrations.AddField(
            model_name='resultsheet',
            name='pass_status',
            field=models.CharField(
                choices=[
                    ('Incomplete', 'Incomplete'),
                    ('Pass',       'Pass'),
                    ('Fail',       'Fail'),
                    ('Withheld',   'Withheld'),
                ],
                default='Incomplete',
                max_length=12,
            ),
        ),
        migrations.AddIndex(
            model_name='resultsheet',
            index=models.Index(fields=['pass_status'], name='idx_result_pass_status'),
        ),

        # ── 2. exam_attempt ───────────────────────────────────────────────────
        migrations.CreateModel(
            name='ExamAttempt',
            fields=[
                ('id',           models.AutoField(primary_key=True, serialize=False)),
                ('attempt_type', models.CharField(
                    choices=[
                        ('Regular',        'Regular'),
                        ('Makeup',         'Makeup'),
                        ('Backlog',        'Backlog'),
                        ('SpecialBacklog', 'Special Backlog'),
                    ],
                    max_length=15,
                )),
                ('attempt_no',   models.PositiveSmallIntegerField()),
                ('academic_year',models.CharField(max_length=9)),
                ('conducted_on', models.DateField(blank=True, null=True)),
                ('ese_marks',    models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ('status',       models.CharField(
                    choices=[
                        ('Scheduled', 'Scheduled'),
                        ('Appeared',  'Appeared'),
                        ('Absent',    'Absent'),
                        ('Pass',      'Pass'),
                        ('Fail',      'Fail'),
                        ('Withheld',  'Withheld'),
                    ],
                    default='Scheduled',
                    max_length=12,
                )),
                ('remarks',      models.TextField(blank=True, null=True)),
                ('entered_at',   models.DateTimeField(blank=True, null=True)),
                ('updated_at',   models.DateTimeField(auto_now=True)),
                ('course',       models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='exam_attempts',
                    to='core.ccr',
                )),
                ('entered_by',   models.ForeignKey(
                    blank=True, db_column='entered_by', null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='entered_attempts',
                    to='core.faculty',
                )),
                ('student',      models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='exam_attempts',
                    to='core.student',
                )),
            ],
            options={'db_table': 'exam_attempt'},
        ),
        migrations.AlterUniqueTogether(
            name='examattempt',
            unique_together={('student', 'course', 'attempt_type', 'attempt_no')},
        ),
        migrations.AddIndex(
            model_name='examattempt',
            index=models.Index(fields=['student'],       name='idx_attempt_student'),
        ),
        migrations.AddIndex(
            model_name='examattempt',
            index=models.Index(fields=['course'],        name='idx_attempt_course'),
        ),
        migrations.AddIndex(
            model_name='examattempt',
            index=models.Index(fields=['attempt_type'],  name='idx_attempt_type'),
        ),
        migrations.AddIndex(
            model_name='examattempt',
            index=models.Index(fields=['status'],        name='idx_attempt_status'),
        ),
        migrations.AddIndex(
            model_name='examattempt',
            index=models.Index(fields=['academic_year'], name='idx_attempt_year'),
        ),

        # ── 3. student_backlog ────────────────────────────────────────────────
        migrations.CreateModel(
            name='StudentBacklog',
            fields=[
                ('id',      models.AutoField(primary_key=True, serialize=False)),
                ('reason',  models.CharField(
                    choices=[
                        ('Failed',   'Failed'),
                        ('Absent',   'Absent'),
                        ('Detained', 'Detained'),
                    ],
                    max_length=10,
                )),
                ('status',  models.CharField(
                    choices=[
                        ('Active',  'Active'),
                        ('Cleared', 'Cleared'),
                        ('Lapsed',  'Lapsed'),
                    ],
                    db_index=True,
                    default='Active',
                    max_length=8,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('clearing_attempt', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='cleared_backlogs',
                    to='core.examattempt',
                )),
                ('course',   models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='backlogs',
                    to='core.ccr',
                )),
                ('origin_attempt', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_backlogs',
                    to='core.examattempt',
                )),
                ('student',  models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='backlogs',
                    to='core.student',
                )),
            ],
            options={'db_table': 'student_backlog'},
        ),
        migrations.AddIndex(
            model_name='studentbacklog',
            index=models.Index(fields=['student', 'status'], name='idx_backlog_student_status'),
        ),
        migrations.AddIndex(
            model_name='studentbacklog',
            index=models.Index(fields=['course',  'status'], name='idx_backlog_course_status'),
        ),

        # ── 4. course_exam_stats ──────────────────────────────────────────────
        migrations.CreateModel(
            name='CourseExamStats',
            fields=[
                ('id',               models.AutoField(primary_key=True, serialize=False)),
                ('academic_year',    models.CharField(db_index=True, max_length=9)),
                ('attempt_type',     models.CharField(
                    choices=[
                        ('Regular',        'Regular'),
                        ('Makeup',         'Makeup'),
                        ('Backlog',        'Backlog'),
                        ('SpecialBacklog', 'Special Backlog'),
                    ],
                    max_length=15,
                )),
                ('total_registered', models.PositiveIntegerField(default=0)),
                ('total_appeared',   models.PositiveIntegerField(default=0)),
                ('total_absent',     models.PositiveIntegerField(default=0)),
                ('total_pass',       models.PositiveIntegerField(default=0)),
                ('total_fail',       models.PositiveIntegerField(default=0)),
                ('total_withheld',   models.PositiveIntegerField(default=0)),
                ('pass_rate',        models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('avg_marks',        models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ('computed_at',      models.DateTimeField(auto_now=True)),
                ('course',           models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='exam_stats',
                    to='core.ccr',
                )),
            ],
            options={'db_table': 'course_exam_stats'},
        ),
        migrations.AlterUniqueTogether(
            name='courseexamstats',
            unique_together={('course', 'academic_year', 'attempt_type')},
        ),
        migrations.AddIndex(
            model_name='courseexamstats',
            index=models.Index(fields=['course', 'academic_year'], name='idx_stats_course_year'),
        ),
    ]
