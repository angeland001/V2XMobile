import { makeAutoObservable } from 'mobx';

export type PreemptionZoneDisplayMode = 'full' | 'icon' | 'off';

export class SettingsViewModel {
  safetyAlerts = true;
  regulatoryAlerts = true;
  informationalAlerts = true;
  carDisplayAlerts = true;
  showVehicles = true;
  showLanes = false;
  preemptionBannerEnabled = true;
  preemptionZoneDisplay: PreemptionZoneDisplayMode = 'full';
  sdsmDisplayRadiusM = 250;

  constructor() {
    makeAutoObservable(this);
  }
}

export default SettingsViewModel;
