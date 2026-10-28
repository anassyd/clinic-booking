<?php

namespace App\Services\WhatsApp;

/** A pre-approved template message (Meta requires templates for business-initiated chats). */
final readonly class WhatsAppMessage
{
    /** @param list<string> $parameters body {{1}}, {{2}}, … in order */
    public function __construct(
        public string $template,
        public string $language,
        public array $parameters,
    ) {}
}
