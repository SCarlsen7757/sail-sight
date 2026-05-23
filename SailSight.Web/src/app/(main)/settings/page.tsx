"use client";

import { useUnitPrefs, DEFAULT_PREFS } from "@/store/settings";
import { Button, Card, Select } from "@/components/ui/controls";
import { useToast } from "@/hooks/useToast";

export default function SettingsPage() {
  const { prefs, update, reset } = useUnitPrefs();
  const toast = useToast();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Unit preferences</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm text-text-secondary">Boat speed</span>
            <Select
              value={prefs.boatSpeed}
              onChange={(e) => update({ boatSpeed: e.target.value as any })}
            >
              <option value="kts">Knots (kn)</option>
              <option value="kmh">km/h</option>
              <option value="mph">mph</option>
            </Select>
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">Wind speed</span>
            <Select
              value={prefs.wind}
              onChange={(e) => update({ wind: e.target.value as any })}
            >
              <option value="kts">Knots (kn)</option>
              <option value="ms">m/s</option>
              <option value="kmh">km/h</option>
            </Select>
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">Course length</span>
            <Select
              value={prefs.course}
              onChange={(e) => update({ course: e.target.value as any })}
            >
              <option value="nm">Nautical miles</option>
              <option value="km">Kilometres</option>
              <option value="mi">Miles</option>
              <option value="m">Metres</option>
            </Select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => { reset(); toast.push({ kind: "info", message: `Reset to defaults (${DEFAULT_PREFS.boatSpeed})` }); }}
          >
            Reset to defaults
          </Button>
        </div>
      </Card>
    </div>
  );
}
