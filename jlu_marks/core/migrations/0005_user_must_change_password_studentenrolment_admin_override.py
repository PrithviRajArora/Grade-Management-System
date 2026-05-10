from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_ccr_is_deprecated_alter_courseexamstats_id_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='must_change_password',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='studentenrolment',
            name='admin_override',
            field=models.BooleanField(default=False),
        ),
    ]
