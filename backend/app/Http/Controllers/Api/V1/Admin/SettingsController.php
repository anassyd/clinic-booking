<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Support\ClinicSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => array_intersect_key(ClinicSettings::all(), array_flip(ClinicSettings::EDITABLE))]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'weekly_off_days' => ['sometimes', 'array'],
            'weekly_off_days.*' => ['integer', 'between:0,6'],
            'vat_rate' => ['sometimes', 'numeric', 'between:0,100'],
            ...collect(ClinicSettings::EDITABLE)
                ->reject(fn ($key) => in_array($key, ['weekly_off_days', 'vat_rate'], true))
                ->mapWithKeys(fn ($key) => [$key => ['sometimes', 'integer', 'min:0', 'max:1000']])
                ->all(),
        ]);

        ClinicSettings::update($data);

        return $this->show();
    }
}
