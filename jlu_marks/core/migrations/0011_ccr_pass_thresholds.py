from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_add_ia_ese_pass_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='ccr',
            name='ia_pass_min',
            field=models.DecimalField(
                decimal_places=2, default=12, max_digits=6,
                help_text='Minimum int_total to pass IA (out of int_weightage). Default: 12 (40% of 30).',
            ),
        ),
        migrations.AddField(
            model_name='ccr',
            name='ese_pass_min',
            field=models.DecimalField(
                decimal_places=2, default=28, max_digits=6,
                help_text='Minimum ese_marks to pass ESE (out of ese_max_marks). Default: 28 (40% of 70).',
            ),
        ),
        migrations.AddField(
            model_name='ccr',
            name='overall_pass_min',
            field=models.DecimalField(
                decimal_places=2, default=40, max_digits=6,
                help_text='Minimum grand_total to pass overall (out of 100). Default: 40.',
            ),
        ),
    ]
