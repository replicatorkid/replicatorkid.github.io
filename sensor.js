///////////////////////////////////////////////////////////////////////////
//
// sensors.js
//
// Lightweight Sensors abstraction — simple and usable
// Put this file in your site (e.g. assets/js/sensor.js) and include it in the page.
// Usage: Sensors.start();  // then read Sensors.gps / Sensors.orientation / Sensors.acceleration / Sensors.rotation

const Sensors = {
  updateRate: 30, // Hz
  running: false,
  timer: null,

  // public outputs (smoothed)
  gps: { lat: null, lon: null, alt: null, accuracy: null, speed: null, heading: null, timestamp: null },
  orientation: { heading: null, pitch: null, roll: null }, // degrees
  acceleration: { x: null, y: null, z: null }, // m/s^2
  rotation: { x: null, y: null, z: null }, // deg/s

  // status
  status: { gps: false, accelerometer: false, gyroscope: false, compass: false, orientation: false },

  // raw storage and handles
  raw: { gps: {}, accel: {}, gyro: {}, orientation: {}, magnetometer: {} },
  _handles: { gpsWatchId: null, devicemotionHandler: null, deviceorientationHandler: null, sensors: [] },

  // tiny exponential smoothing helper
  _smooth(prev, next, alpha = 0.6) {
    if (prev == null) return next;
    return prev * (1 - alpha) + next * alpha;
  },

  async start() {
    if (this.running) return;
    console.log("Sensors: Starting...");
    await this.requestPermissions();
    this.startGPS();
    this.startAccelerometer();
    this.startGyroscope();
    this.startOrientation();
    this.startMagnetometer();
    this.timer = setInterval(() => this.update(), 1000 / this.updateRate);
    this.running = true;
  },

  stop() {
    if (!this.running) return;
    console.log("Sensors: Stopping...");
    clearInterval(this.timer);
    this.timer = null;

    // Stop GPS
    if (this._handles.gpsWatchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this._handles.gpsWatchId);
      this._handles.gpsWatchId = null;
    }

    // Stop generic sensors
    for (const s of this._handles.sensors) {
      try { s.stop && s.stop(); } catch (e) { /* ignore */ }
    }
    this._handles.sensors = [];

    // Remove event listeners
    if (this._handles.devicemotionHandler) {
      window.removeEventListener('devicemotion', this._handles.devicemotionHandler);
      this._handles.devicemotionHandler = null;
    }
    if (this._handles.deviceorientationHandler) {
      window.removeEventListener('deviceorientation', this._handles.deviceorientationHandler);
      this._handles.deviceorientationHandler = null;
    }

    this.running = false;
  },

  async requestPermissions() {
    // iOS Safari requires explicit permission for DeviceMotion / DeviceOrientation.
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const resp = await DeviceMotionEvent.requestPermission();
        console.log("DeviceMotion permission:", resp);
      }
    } catch (e) {
      console.warn("DeviceMotionEvent.requestPermission failed:", e);
    }

    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const resp = await DeviceOrientationEvent.requestPermission();
        console.log("DeviceOrientation permission:", resp);
      }
    } catch (e) {
      console.warn("DeviceOrientationEvent.requestPermission failed:", e);
    }

    // For geolocation, prompt by calling getCurrentPosition once (will show prompt if needed).
    if ('geolocation' in navigator) {
      try {
        navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 1000 });
      } catch (e) {
        // ignore
      }
    }
  },

  // GPS
  startGPS() {
    if (!('geolocation' in navigator)) {
      this.status.gps = false;
      return;
    }
    const opts = { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 };
    const success = (p) => {
      const c = p.coords;
      this.raw.gps = {
        lat: c.latitude, lon: c.longitude, alt: c.altitude,
        accuracy: c.accuracy, speed: c.speed, heading: c.heading, timestamp: p.timestamp
      };
      this.status.gps = true;
    };
    const error = (e) => {
      console.warn("Geolocation error:", e);
      this.status.gps = false;
    };
    const id = navigator.geolocation.watchPosition(success, error, opts);
    this._handles.gpsWatchId = id;
  },

  // Accelerometer: Generic Sensor API or DeviceMotion fallback
  startAccelerometer() {
    const tryGeneric = () => {
      if (window.Accelerometer) {
        try {
          const sensor = new Accelerometer({ frequency: this.updateRate });
          sensor.addEventListener('reading', () => {
            this.raw.accel = { x: sensor.x, y: sensor.y, z: sensor.z, timestamp: Date.now() };
            this.status.accelerometer = true;
          });
          sensor.addEventListener('error', (e) => console.warn("Accelerometer error:", e.error));
          sensor.start();
          this._handles.sensors.push(sensor);
          return true;
        } catch (e) {
          console.warn("Accelerometer start failed:", e);
        }
      }
      return false;
    };

    if (!tryGeneric()) {
      // DeviceMotion fallback
      const handler = (ev) => {
        const a = ev.accelerationIncludingGravity || ev.acceleration;
        if (!a) return;
        this.raw.accel = { x: a.x, y: a.y, z: a.z, timestamp: ev.timeStamp || Date.now() };
        this.status.accelerometer = true;
      };
      this._handles.devicemotionHandler = handler;
      window.addEventListener('devicemotion', handler, { passive: true });
    }
  },

  // Gyroscope: Generic Sensor API or rotationRate fallback
  startGyroscope() {
    const tryGeneric = () => {
      if (window.Gyroscope) {
        try {
          const sensor = new Gyroscope({ frequency: this.updateRate });
          sensor.addEventListener('reading', () => {
            this.raw.gyro = { x: sensor.x, y: sensor.y, z: sensor.z, timestamp: Date.now() };
            this.status.gyroscope = true;
          });
          sensor.addEventListener('error', (e) => console.warn("Gyroscope error:", e.error));
          sensor.start();
          this._handles.sensors.push(sensor);
          return true;
        } catch (e) {
          console.warn("Gyroscope start failed:", e);
        }
      }
      return false;
    };

    if (!tryGeneric()) {
      // fallback to DeviceMotionEvent.rotationRate
      const handler = (ev) => {
        if (!ev.rotationRate) return;
        const r = ev.rotationRate;
        // rotationRate units: deg/sec (alpha, beta, gamma)
        this.raw.gyro = { x: r.beta || 0, y: r.gamma || 0, z: r.alpha || 0, timestamp: ev.timeStamp || Date.now() };
        this.status.gyroscope = true;
      };
      // if devicemotion handler already exists, chain it
      if (this._handles.devicemotionHandler) {
        const prev = this._handles.devicemotionHandler;
        const chained = (ev) => { prev(ev); handler(ev); };
        window.removeEventListener('devicemotion', prev);
        this._handles.devicemotionHandler = chained;
        window.addEventListener('devicemotion', chained, { passive: true });
      } else {
        this._handles.devicemotionHandler = handler;
        window.addEventListener('devicemotion', handler, { passive: true });
      }
    }
  },

  // Orientation: AbsoluteOrientationSensor or DeviceOrientationEvent (alpha = compass/heading)
  startOrientation() {
    const tryGeneric = () => {
      if (window.AbsoluteOrientationSensor) {
        try {
          const sensor = new AbsoluteOrientationSensor({ frequency: this.updateRate });
          sensor.addEventListener('reading', () => {
            // sensor.quaternion — convert to Euler (heading, pitch, roll)
            const q = sensor.quaternion;
            if (q && q.length === 4) {
              const [x, y, z, w] = q;
              // Convert quaternion to Euler angles (degrees)
              const ysqr = y * y;

              // roll (x-axis rotation)
              let t0 = +2.0 * (w * x + y * z);
              let t1 = +1.0 - 2.0 * (x * x + ysqr);
              let roll = Math.atan2(t0, t1);

              // pitch (y-axis rotation)
              let t2 = +2.0 * (w * y - z * x);
              t2 = t2 > 1.0 ? 1.0 : t2;
              t2 = t2 < -1.0 ? -1.0 : t2;
              let pitch = Math.asin(t2);

              // yaw (z-axis rotation)
              let t3 = +2.0 * (w * z + x * y);
              let t4 = +1.0 - 2.0 * (ysqr + z * z);
              let yaw = Math.atan2(t3, t4);

              // radians -> degrees
              const RAD2DEG = 180 / Math.PI;
              this.raw.orientation = {
                heading: ((yaw * RAD2DEG) + 360) % 360,
                pitch: pitch * RAD2DEG,
                roll: roll * RAD2DEG,
                timestamp: Date.now()
              };
              this.status.orientation = true;
              this.status.compass = true;
            }
          });
          sensor.addEventListener('error', (e) => console.warn("AbsoluteOrientationSensor error:", e.error));
          sensor.start();
          this._handles.sensors.push(sensor);
          return true;
        } catch (e) {
          console.warn("AbsoluteOrientationSensor start failed:", e);
        }
      }
      return false;
    };

    if (!tryGeneric()) {
      const handler = (ev) => {
        // alpha: rotation around z (0..360) — often used as heading (but not always absolute)
        const alpha = ev.alpha; // 0..360
        const beta = ev.beta; // -180..180 (pitch)
        const gamma = ev.gamma; // -90..90 (roll)
        // webkitCompassHeading exists on some iOS devices (already adjusted)
        const heading = ev.webkitCompassHeading != null ? ev.webkitCompassHeading : alpha;
        if (heading != null) {
          this.raw.orientation = { heading: heading, pitch: beta, roll: gamma, timestamp: ev.timeStamp || Date.now() };
          this.status.orientation = true;
          this.status.compass = true;
        }
      };
      this._handles.deviceorientationHandler = handler;
      window.addEventListener('deviceorientation', handler, { passive: true });
    }
  },

  // Magnetometer (best-effort)
  startMagnetometer() {
    if (window.Magnetometer) {
      try {
        const sensor = new Magnetometer({ frequency: this.updateRate });
        sensor.addEventListener('reading', () => {
          this.raw.magnetometer = { x: sensor.x, y: sensor.y, z: sensor.z, timestamp: Date.now() };
          this.status.compass = true;
        });
        sensor.addEventListener('error', (e) => console.warn("Magnetometer error:", e.error));
        sensor.start();
        this._handles.sensors.push(sensor);
      } catch (e) {
        console.warn("Magnetometer start failed:", e);
      }
    }
  },

  // Called on interval, copies raw to public outputs and applies simple smoothing
  update() {
    // GPS
    if (this.raw.gps && this.raw.gps.lat != null) {
      this.gps.lat = this._smooth(this.gps.lat, this.raw.gps.lat, 0.5);
      this.gps.lon = this._smooth(this.gps.lon, this.raw.gps.lon, 0.5);
      this.gps.alt = this._smooth(this.gps.alt, this.raw.gps.alt != null ? this.raw.gps.alt : this.gps.alt, 0.5);
      this.gps.accuracy = this.raw.gps.accuracy || this.gps.accuracy;
      if (this.raw.gps.speed != null) this.gps.speed = this._smooth(this.gps.speed, this.raw.gps.speed, 0.6);
      if (this.raw.gps.heading != null) this.gps.heading = this._smooth(this.gps.heading, this.raw.gps.heading, 0.6);
      this.gps.timestamp = this.raw.gps.timestamp || this.gps.timestamp;
    }

    // Acceleration
    if (this.raw.accel && this.raw.accel.x != null) {
      this.acceleration.x = this._smooth(this.acceleration.x, this.raw.accel.x, 0.6);
      this.acceleration.y = this._smooth(this.acceleration.y, this.raw.accel.y, 0.6);
      this.acceleration.z = this._smooth(this.acceleration.z, this.raw.accel.z, 0.6);
    }

    // Rotation (gyro)
    if (this.raw.gyro && this.raw.gyro.x != null) {
      this.rotation.x = this._smooth(this.rotation.x, this.raw.gyro.x, 0.6);
      this.rotation.y = this._smooth(this.rotation.y, this.raw.gyro.y, 0.6);
      this.rotation.z = this._smooth(this.rotation.z, this.raw.gyro.z, 0.6);
    }

    // Orientation
    if (this.raw.orientation && this.raw.orientation.heading != null) {
      // Normalize heading to 0..360
      const h = ((this.raw.orientation.heading % 360) + 360) % 360;
      this.orientation.heading = this._smooth(this.orientation.heading, h, 0.7);
      this.orientation.pitch = this._smooth(this.orientation.pitch, this.raw.orientation.pitch || 0, 0.6);
      this.orientation.roll = this._smooth(this.orientation.roll, this.raw.orientation.roll || 0, 0.6);
    }
  }

};

// expose globally
window.Sensors = Sensors;
