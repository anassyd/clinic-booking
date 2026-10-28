<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Http;

/** Meta WhatsApp Business Cloud API. */
class CloudWhatsAppClient implements WhatsAppClient
{
    public function __construct(private readonly array $config) {}

    public function send(string $to, WhatsAppMessage $message): string
    {
        $response = Http::withToken($this->config['token'])
            ->timeout(15)
            ->post("https://graph.facebook.com/{$this->config['api_version']}/{$this->config['phone_number_id']}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'template',
                'template' => [
                    'name' => $message->template,
                    'language' => ['code' => $message->language],
                    'components' => [[
                        'type' => 'body',
                        'parameters' => array_map(fn (string $text) => ['type' => 'text', 'text' => $text], $message->parameters),
                    ]],
                ],
            ])
            ->throw()
            ->json();

        return (string) ($response['messages'][0]['id'] ?? '');
    }
}
