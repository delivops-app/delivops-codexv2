from __future__ import annotations


def send_activation_email(email: str, link: str) -> None:
    """Send activation link to a driver via email.

    This is a stub implementation that simply prints the link.
    """
    print(f"Activation email to {email}: {link}")
