<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;

#[Table(key: 'key', keyType: 'string', incrementing: false)]
#[Fillable(['key', 'value'])]
class Setting extends Model
{
    protected function casts(): array
    {
        return ['value' => 'json'];
    }
}
