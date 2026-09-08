import random
import time
import uuid


def new_id():
    return str(uuid.uuid4())


# Collision-resistant registration number: prefix + last 4 digits of
# timestamp + 2 random digits, e.g. SUMMIT-4829173. Safe for event-scale
# concurrent registrations.
def registration_number(prefix="SUMMIT"):
    ts = str(int(time.time() * 1000))[-4:]
    rand = str(random.randint(10, 99))
    return f"{prefix}-{ts}{rand}"
