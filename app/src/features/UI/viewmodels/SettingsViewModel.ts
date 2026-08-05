import { makeAutoObservable } from 'mobx';

export type PreemptionZoneDisplayMode = 'full' | 'icon' | 'off';

export class SettingsViewModel {
  safetyAlerts = true;
  regulatoryAlerts = true;
  informationalAlerts = true;
  showVehicles = true;
  showLanes = false;
  trafficLightPanelEnabled = true;
  preemptionZoneDisplay: PreemptionZoneDisplayMode = 'full';

  constructor() {
    makeAutoObservable(this);
  }
}

export default SettingsViewModel;
