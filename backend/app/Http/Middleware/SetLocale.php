<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Picks ar/en from Accept-Language, then the user's saved locale (NFR-05). */
class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->getPreferredLanguage(['ar', 'en']);
        if (! $request->hasHeader('Accept-Language') && $request->user()) {
            $locale = $request->user()->locale;
        }
        app()->setLocale($locale ?: config('app.locale'));

        return $next($request);
    }
}
