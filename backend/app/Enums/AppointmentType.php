<?php

namespace App\Enums;

enum AppointmentType: string
{
    case Consultation = 'consultation';
    case FollowUp = 'follow_up';
}
