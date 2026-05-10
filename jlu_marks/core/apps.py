from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name               = 'core'
    verbose_name       = 'JLU Marks Core'

    def ready(self):
        import core.signals  # noqa: F401 — registers all signal handlers
