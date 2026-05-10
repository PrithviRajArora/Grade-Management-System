from django.db import migrations, models
import django.core.validators
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [

        # ── Enums (PostgreSQL CHECK constraints are added via model constraints) ──

        migrations.CreateModel(
            name='User',
            fields=[
                ('id',            models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('password',      models.CharField(max_length=128, verbose_name='password')),
                ('last_login',    models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser',  models.BooleanField(default=False)),
                ('jlu_id',        models.CharField(max_length=15, unique=True)),
                ('first_name',    models.CharField(max_length=100)),
                ('last_name',     models.CharField(max_length=100)),
                ('email',         models.EmailField(max_length=150, unique=True)),
                ('role',          models.CharField(
                    choices=[('admin','Admin'),('faculty','Faculty'),('student','Student')],
                    max_length=10,
                )),
                ('is_active',     models.BooleanField(default=True)),
                ('is_staff',      models.BooleanField(default=False)),
                ('created_at',    models.DateTimeField(auto_now_add=True)),
                ('groups',        models.ManyToManyField(
                    blank=True, related_name='user_set', related_query_name='user',
                    to='auth.group', verbose_name='groups',
                )),
                ('user_permissions', models.ManyToManyField(
                    blank=True, related_name='user_set', related_query_name='user',
                    to='auth.permission', verbose_name='user permissions',
                )),
            ],
            options={'db_table': 'users'},
        ),

        migrations.CreateModel(
            name='FacultyOf',
            fields=[
                ('id',         models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('name',       models.CharField(max_length=150, unique=True)),
                ('short_name', models.CharField(blank=True, max_length=30, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'faculty_of'},
        ),

        migrations.CreateModel(
            name='School',
            fields=[
                ('id',         models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('name',       models.CharField(max_length=150, unique=True)),
                ('short_name', models.CharField(blank=True, max_length=30, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('faculty_of', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='schools', to='core.facultyof',
                )),
            ],
            options={
                'db_table': 'school',
                'indexes': [models.Index(fields=['faculty_of'], name='idx_school_faculty_of')],
            },
        ),

        migrations.CreateModel(
            name='Program',
            fields=[
                ('id',           models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('name',         models.CharField(max_length=100)),
                ('short_name',   models.CharField(max_length=20)),
                ('duration_yrs', models.SmallIntegerField()),
                ('created_at',   models.DateTimeField(auto_now_add=True)),
                ('school',       models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='programs', to='core.school',
                )),
            ],
            options={
                'db_table': 'program',
                'indexes': [models.Index(fields=['school'], name='idx_program_school')],
            },
        ),

        migrations.AddConstraint(
            model_name='program',
            constraint=models.UniqueConstraint(fields=['school','short_name'], name='program_school_short_name_uniq'),
        ),

        migrations.CreateModel(
            name='Faculty',
            fields=[
                ('faculty_id',  models.CharField(max_length=10, primary_key=True, serialize=False)),
                ('name',        models.CharField(max_length=150)),
                ('department',  models.CharField(blank=True, max_length=150, null=True)),
                ('created_at',  models.DateTimeField(auto_now_add=True)),
                ('school',      models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='faculty_members', to='core.school',
                )),
                ('user',        models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='faculty_profile', to='core.user',
                )),
            ],
            options={
                'db_table': 'faculty',
                'verbose_name_plural': 'Faculty',
                'indexes': [models.Index(fields=['school'], name='idx_faculty_school')],
            },
        ),

        migrations.CreateModel(
            name='Student',
            fields=[
                ('student_id',    models.CharField(max_length=10, primary_key=True, serialize=False)),
                ('roll_no',       models.CharField(max_length=15, unique=True)),
                ('gender',        models.CharField(
                    choices=[('Male','Male'),('Female','Female'),('Other','Other')],
                    max_length=6,
                )),
                ('semester',      models.SmallIntegerField(
                    validators=[
                        django.core.validators.MinValueValidator(1),
                        django.core.validators.MaxValueValidator(12),
                    ],
                )),
                ('section',       models.CharField(blank=True, max_length=10, null=True)),
                ('academic_year', models.CharField(max_length=9)),
                ('created_at',    models.DateTimeField(auto_now_add=True)),
                ('program',       models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='students', to='core.program',
                )),
                ('user',          models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='student_profile', to='core.user',
                )),
            ],
            options={
                'db_table': 'student',
                'indexes': [models.Index(fields=['program'], name='idx_student_program')],
            },
        ),

        migrations.AddConstraint(
            model_name='student',
            constraint=models.CheckConstraint(
                check=models.Q(semester__gte=1) & models.Q(semester__lte=12),
                name='student_semester_check',
            ),
        ),

        migrations.CreateModel(
            name='CCR',
            fields=[
                ('course_code',     models.CharField(max_length=15, primary_key=True, serialize=False)),
                ('course_name',     models.CharField(max_length=150)),
                ('course_type',     models.CharField(
                    choices=[('Foundation','Foundation'),('Core','Core'),('MD','MD'),
                             ('SEC','SEC'),('AECC','AECC'),('OE','OE')],
                    max_length=10,
                )),
                ('semester',        models.SmallIntegerField(
                    validators=[
                        django.core.validators.MinValueValidator(1),
                        django.core.validators.MaxValueValidator(12),
                    ],
                )),
                ('academic_year',   models.CharField(max_length=9)),
                ('term',            models.SmallIntegerField()),
                ('lecture_hrs',     models.SmallIntegerField(default=0)),
                ('tutorial_hrs',    models.SmallIntegerField(default=0)),
                ('practical_hrs',   models.SmallIntegerField(default=0)),
                ('total_hrs',       models.SmallIntegerField(blank=True, null=True)),
                ('credits',         models.SmallIntegerField()),
                ('int_weightage',   models.SmallIntegerField()),
                ('ese_weightage',   models.SmallIntegerField()),
                ('ese_mode',        models.CharField(
                    choices=[('Written','Written'),('Viva Voce','Viva Voce'),
                             ('Coding Test','Coding Test'),('Practical','Practical')],
                    max_length=15,
                )),
                ('ese_duration_hrs', models.SmallIntegerField(default=3)),
                ('ese_max_marks',   models.SmallIntegerField(default=100)),
                ('created_at',      models.DateTimeField(auto_now_add=True)),
                ('faculty',         models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='courses', to='core.faculty',
                )),
                ('program',         models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='courses', to='core.program',
                )),
            ],
            options={
                'db_table': 'ccr',
                'indexes': [
                    models.Index(fields=['faculty'],                   name='idx_ccr_faculty'),
                    models.Index(fields=['program'],                   name='idx_ccr_program'),
                    models.Index(fields=['semester','academic_year'],  name='idx_ccr_sem_year'),
                ],
            },
        ),

        migrations.AddConstraint(
            model_name='ccr',
            constraint=models.CheckConstraint(
                check=models.Q(semester__gte=1) & models.Q(semester__lte=12),
                name='ccr_semester_check',
            ),
        ),
        migrations.AddConstraint(
            model_name='ccr',
            constraint=models.CheckConstraint(
                check=models.Q(int_weightage__gte=0) & models.Q(ese_weightage__gte=0),
                name='ccr_weightage_positive',
            ),
        ),

        # DB-level weightage sum constraint (raw SQL)
        migrations.RunSQL(
            sql="""
                ALTER TABLE ccr
                ADD CONSTRAINT weightage_check
                CHECK (int_weightage + ese_weightage = 100);
            """,
            reverse_sql="ALTER TABLE ccr DROP CONSTRAINT IF EXISTS weightage_check;",
        ),

        migrations.CreateModel(
            name='StudentEnrolment',
            fields=[
                ('id',            models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('academic_year', models.CharField(max_length=9)),
                ('enrolled_at',   models.DateTimeField(auto_now_add=True)),
                ('course',        models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='enrolments', to='core.ccr',
                )),
                ('student',       models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='enrolments', to='core.student',
                )),
            ],
            options={
                'db_table': 'student_enrolment',
                'indexes': [
                    models.Index(fields=['student'], name='idx_enrolment_student'),
                    models.Index(fields=['course'],  name='idx_enrolment_course'),
                ],
            },
        ),

        migrations.AddConstraint(
            model_name='studentenrolment',
            constraint=models.UniqueConstraint(
                fields=['student','course','academic_year'],
                name='studentenrolment_student_course_year_uniq',
            ),
        ),

        migrations.CreateModel(
            name='IAComponent',
            fields=[
                ('id',         models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('name',       models.CharField(max_length=100)),
                ('weightage',  models.DecimalField(decimal_places=2, max_digits=5)),
                ('max_marks',  models.DecimalField(decimal_places=2, max_digits=6)),
                ('mode',       models.CharField(
                    choices=[('Online','Online'),('Offline','Offline'),
                             ('Certificate','Certificate'),('Hackathon','Hackathon')],
                    max_length=15,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('course',     models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ia_components', to='core.ccr',
                )),
            ],
            options={'db_table': 'ia_component'},
        ),

        migrations.AddConstraint(
            model_name='iacomponent',
            constraint=models.UniqueConstraint(
                fields=['course','name'],
                name='iacomponent_course_name_uniq',
            ),
        ),

        migrations.CreateModel(
            name='MarksEntry',
            fields=[
                ('id',             models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('marks_obtained', models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ('scaled_marks',   models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ('entered_at',     models.DateTimeField(blank=True, null=True)),
                ('updated_at',     models.DateTimeField(auto_now=True)),
                ('component',      models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='marks_entries', to='core.iacomponent',
                )),
                ('entered_by',     models.ForeignKey(
                    blank=True, db_column='entered_by', null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='entered_marks', to='core.faculty',
                )),
                ('student',        models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='marks_entries', to='core.student',
                )),
            ],
            options={
                'db_table': 'marks_entry',
                'indexes': [
                    models.Index(fields=['student'],   name='idx_marks_student'),
                    models.Index(fields=['component'], name='idx_marks_component'),
                ],
            },
        ),

        migrations.AddConstraint(
            model_name='marksentry',
            constraint=models.UniqueConstraint(
                fields=['student','component'],
                name='marksentry_student_component_uniq',
            ),
        ),

        migrations.CreateModel(
            name='ResultSheet',
            fields=[
                ('id',          models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('int_total',   models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ('ese_marks',   models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ('grand_total', models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ('computed_at', models.DateTimeField(auto_now=True)),
                ('course',      models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='results', to='core.ccr',
                )),
                ('student',     models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='results', to='core.student',
                )),
            ],
            options={
                'db_table': 'result_sheet',
                'indexes': [
                    models.Index(fields=['student'], name='idx_result_student'),
                    models.Index(fields=['course'],  name='idx_result_course'),
                ],
            },
        ),

        migrations.AddConstraint(
            model_name='resultsheet',
            constraint=models.UniqueConstraint(
                fields=['student','course'],
                name='resultsheet_student_course_uniq',
            ),
        ),
    ]
