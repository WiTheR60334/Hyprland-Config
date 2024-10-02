class SettingsManager {
  constructor(initialProperties, area, domain) {
    this.area = area;
    this.initialProperties = initialProperties;
    this.domain = domain;

    this.pauseKey = getPauseKeyFromDomain(domain);
    this.initialProperties[this.pauseKey] = false;
    this.isPausedByDefault = PAUSED_BY_DEFAULT_SITE_LIST.includes(domain);

    this.isReadyPromise = this.assignInitialValues();
    this.setupOnChangeListener();
  }

  async assignInitialValues() {
    this.properties = {};
    const result = await browser.storage[this.area].get(this.initialProperties);
    for (const key in result) {
      this.properties[key] = { value: result[key], listeners: [] };
    }
  }

  setupOnChangeListener() {
    browser.storage.onChanged.addListener(async (changes, changedArea) => {
      if (changedArea !== this.area) {
        return;
      }

      for (const property in changes) {
        if (!(property in this.initialProperties)) {
          continue;
        }

        let newValue = changes[property].newValue;
        let oldValue = changes[property].oldValue;

        if (oldValue === newValue) {
          continue;
        }

        if (newValue === undefined) {
          newValue = this.initialProperties[property];
        }

        if (oldValue === undefined) {
          oldValue = this.initialProperties[property];
        }

        await this.isReadyPromise;

        this.properties[property].value = newValue;

        if (property === this.pauseKey && !this.isPausedByDefault) {
          oldValue = !oldValue;
          newValue = !newValue;
        }
        for (const listener of this.properties[property].listeners) {
          listener(newValue, oldValue);
        }
      }
    });
  }

  async get(prop) {
    await this.isReadyPromise;
    return this.properties[prop].value;
  }

  async set(obj) {
    await browser.storage[this.area].set(obj);
  }

  async remove(key) {
    await browser.storage[this.area].remove([key]);
  }

  async isSelectextEnabled() {
    const pauseValue = await this.get(this.pauseKey);
    if (!this.isPausedByDefault) {
      return !pauseValue;
    }
    return pauseValue;
  }

  async addPropertyChangeListener(property, listener) {
    await this.isReadyPromise;
    this.properties[property].listeners.push(listener);
  }

  async pauseSelectext() {
    if (!this.isPausedByDefault) {
      await this.set({ [this.pauseKey]: true });
    } else {
      await this.remove(this.pauseKey);
    }
  }

  async resumeSelectext() {
    if (!this.isPausedByDefault) {
      await this.remove(this.pauseKey);
    } else {
      await this.set({ [this.pauseKey]: true });
    }
  }

  async addPauseChangeListener(listener) {
    await this.isReadyPromise;
    this.properties[this.pauseKey].listeners.push(listener);
  }
}

function initSettings(domain, extraSettings) {
  return new SettingsManager(
    {
      copyTextToggleChecked: true,
      copyTextKeyboardShortcutChecked: true,
      copyScreenshotToggleChecked: true,
      copyScreenshotKeyboardShortcutChecked: true,
      textDisplay: "boxes",
      copyMode: "multiline",
      copyScreenshotUnlocked: false,
      ...extraSettings,
    },
    "sync",
    domain
  );
}

function getPauseKeyFromDomain(domain) {
  if (PAUSED_BY_DEFAULT_SITE_LIST.includes(domain)) {
    return `resume_${domain}`;
  } else {
    return `pause_${domain}`;
  }
}
