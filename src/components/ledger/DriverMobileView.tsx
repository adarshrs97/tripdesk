import React, { useState, useEffect, useRef } from 'react';
import {
  Car,
  Clock,
  Gauge,
  CheckCircle2,
  Moon,
  MapPin,
  Receipt,
  Wifi,
  WifiOff,
  ArrowLeft,
  Camera,
  Languages,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { offlineQueue, QueuedTrip } from '../../services/offlineQueue';
import { ledgerService } from '../../services/ledgerService';
import { DayLedgerEntry } from '../../engine';

interface DriverMobileViewProps {
  onBackToOffice: () => void;
}

export const DriverMobileView: React.FC<DriverMobileViewProps> = ({ onBackToOffice }) => {
  // Language toggle: English ('en') vs Malayalam ('ml')
  const [lang, setLang] = useState<'en' | 'ml'>('en');

  // Shift state: 'idle' (ready to start), 'on_trip' (trip active), 'completed' (trip finished)
  const [shiftState, setShiftState] = useState<'idle' | 'on_trip' | 'completed'>('on_trip');

  // Network & Queue state
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queuedTrips, setQueuedTrips] = useState<QueuedTrip[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form states
  const [startKm, setStartKm] = useState('157434');
  const [startTime, setStartTime] = useState('06:00');
  const [closeKm, setCloseKm] = useState('157541');
  const [closeTime, setCloseTime] = useState('19:30');
  const [nightBata, setNightBata] = useState(false);
  const [outstationBata, setOutstationBata] = useState(false);
  const [tollAmount, setTollAmount] = useState('');
  const [routeNotes, setRouteNotes] = useState('VTL Site Trip • Trivandrum - Kazhakkoottam');

  // Camera & Image Compression State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoSizeKb, setPhotoSizeKb] = useState<number | null>(null);

  // Toast notification
  const [toast, setToast] = useState<string | null>(null);

  // Refresh queued trips from IndexedDB
  const refreshQueue = async () => {
    try {
      const items = await offlineQueue.getAll();
      setQueuedTrips(items);
    } catch {
      setQueuedTrips([]);
    }
  };

  useEffect(() => {
    refreshQueue();

    const handleOnline = () => {
      setIsOffline(false);
      handleSyncNow();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const t = {
    en: {
      appName: 'Starciti Driver Desk',
      driverName: 'Sujith Kumar S',
      vehicle: 'KL01 CP 3284 (7-Seat AC Car)',
      contract: 'Vindhya Telelinks Ltd (VTL)',
      today: 'Monday, 31 August 2026',
      statusIdle: 'Off Duty • Ready to Start',
      statusActive: 'Shift Active • Driving',
      statusFinished: 'Shift Completed & Synced',
      startTripBtn: 'START TRIP / SHIFT',
      finishTripBtn: 'FINISH TRIP / SHIFT',
      startKmLabel: 'Starting Odometer (KM)',
      closeKmLabel: 'Closing Odometer (KM)',
      startTimeLabel: 'Start Time',
      closeTimeLabel: 'Close Time',
      nightBataLabel: 'Night Bata (₹200)',
      nightBataSub: 'Auto-suggested for duty before 6:00 AM or after 10:00 PM',
      outstationLabel: 'Outstation Halt Bata (₹200)',
      tollLabel: 'Toll & Parking Expenses (₹)',
      routeLabel: 'Route & Trip Remarks',
      takeOdoPhoto: 'Take / Attach Odometer Photo',
      photoUploaded: 'Odometer Photo Attached',
      onlineStatus: 'Online • Auto-sync active',
      offlineStatus: 'Offline • IndexedDB Queue active',
      shiftDuration: 'Current Duration',
      totalKmRun: 'Total Kilometres',
      backToOffice: 'Office Ledger Grid',
      syncNow: 'Sync Queue',
    },
    ml: {
      appName: 'സ്റ്റാർസിറ്റി ഡ്രൈവർ ഡെസ്ക്',
      driverName: 'സുജിത് കുമാർ എസ്',
      vehicle: 'KL01 CP 3284 (7-സീറ്റർ എസി കാർ)',
      contract: 'വിന്ധ്യാ ടെലിലിങ്ക്സ് ലിമിറ്റഡ് (VTL)',
      today: 'തിങ്കളാഴ്ച, 31 ആഗസ്റ്റ് 2026',
      statusIdle: 'ഡ്യൂട്ടി ആരംഭിക്കുക',
      statusActive: 'യാത്ര പുരോഗമിക്കുന്നു',
      statusFinished: 'ഡ്യൂട്ടി പൂർത്തിയായി',
      startTripBtn: 'യാത്ര ആരംഭിക്കുക',
      finishTripBtn: 'യാത്ര അവസാനിപ്പിക്കുക',
      startKmLabel: 'തുടക്കത്തിലെ ഓഡോമീറ്റർ (KM)',
      closeKmLabel: 'അവസാനത്തിലെ ഓഡോമീറ്റർ (KM)',
      startTimeLabel: 'തുടങ്ങിയ സമയം',
      closeTimeLabel: 'അവസാനിച്ച സമയം',
      nightBataLabel: 'നൈറ്റ് ബറ്റ (₹200)',
      nightBataSub: 'രാവിലെ 6 ന് മുൻപോ രാത്രി 10 ന് ശേഷമോ ഉള്ള ഡ്യൂട്ടി',
      outstationLabel: 'ഔട്ട്സ്റ്റേഷൻ ബാറ്റ് (₹200)',
      tollLabel: 'ടോൾ / പാർക്കിംഗ് ചെലവ് (₹)',
      routeLabel: 'റൂട്ട് / യാത്ര വിവരങ്ങൾ',
      takeOdoPhoto: 'മീറ്റർ ഫോട്ടോ എടുക്കുക',
      photoUploaded: 'മീറ്റർ ഫോട്ടോ ചേർത്തു',
      onlineStatus: 'ഓൺലൈൻ • ക്ലൗഡ് കണക്റ്റഡ്',
      offlineStatus: 'ഓഫ്‌ലൈൻ • ഫോണിൽ സേവ് ചെയ്തു',
      shiftDuration: 'ഡ്യൂട്ടി സമയം',
      totalKmRun: 'ആകെ ഓടിയ കിലോമീറ്റർ',
      backToOffice: 'ഓഫീസ് ലഡ്ജർ',
      syncNow: 'സിങ്ക് ചെയ്യുക',
    },
  }[lang];

  // Camera file selection & Canvas Compression
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 1024;

        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress to JPEG quality 0.75 (< 150 KB)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        const approxSizeKb = Math.round((compressedDataUrl.length * 3) / 4 / 1024);

        setPhotoDataUrl(compressedDataUrl);
        setPhotoSizeKb(approxSizeKb);
        showToast(`Photo compressed to ${approxSizeKb} KB`);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleStartTrip = () => {
    setShiftState('on_trip');
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    setStartTime(nowTime);
    showToast(lang === 'en' ? 'Shift started!' : 'ഷിഫ്റ്റ് ആരംഭിച്ചു!');
  };

  const handleFinishTrip = async () => {
    setShiftState('completed');
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    setCloseTime(nowTime);

    const tripEntry: DayLedgerEntry = {
      date: '2026-08-31',
      dayStatus: 'RUN',
      vehiclePlate: 'KL01 CP 3284',
      startKm: Number(startKm) || null,
      closeKm: Number(closeKm) || null,
      usedKm: computedKm,
      startTime,
      closeTime: nowTime,
      nightBata,
      outstationBata,
      toll: Number(tollAmount) || 0,
      remarks: routeNotes,
      extra: {
        driverPhoneEntry: true,
        hasPhoto: Boolean(photoDataUrl),
        photoSizeKb,
      },
    };

    if (isOffline) {
      // Save directly to real IndexedDB offline queue
      await offlineQueue.enqueue('b0000000-0000-0000-0000-000000000001', tripEntry, photoDataUrl || undefined);
      await refreshQueue();
      showToast(
        lang === 'en'
          ? 'Offline mode: Trip saved in IndexedDB queue on phone!'
          : 'ഓഫ്‌ലൈൻ ക്യൂവിൽ സേവ് ചെയ്തു'
      );
    } else {
      // Synchronize directly to ledgerService / Supabase
      ledgerService.saveEntry('vtl', '2026-08', tripEntry);
      showToast(
        lang === 'en'
          ? 'Trip completed & synced to office ledger!'
          : 'ഡ്യൂട്ടി രേഖപ്പെടുത്തി ഓഫീസിലേക്ക് അയച്ചു!'
      );
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    const result = await offlineQueue.syncAll(async (item) => {
      // Sync item to ledger
      ledgerService.saveEntry(item.contractId, '2026-08', item.entry);
      return true;
    });
    await refreshQueue();
    setIsSyncing(false);
    showToast(`Synced ${result.synced} offline trips with office`);
  };

  const computedKm = Math.max(0, Number(closeKm) - Number(startKm));

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col justify-between border-x border-gray-200 shadow-xl font-sans">
      {/* Hidden native camera / file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-900 text-white px-4 py-2.5 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Top Mobile Bar */}
      <div className="bg-emerald-900 text-white p-4 sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBackToOffice}
            className="flex items-center gap-1 text-xs text-emerald-200 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.backToOffice}</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Language Switcher Pill */}
            <button
              onClick={() => setLang((l) => (l === 'en' ? 'ml' : 'en'))}
              className="flex items-center gap-1 bg-emerald-800/80 hover:bg-emerald-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-700 transition"
              title="Toggle English / Malayalam"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'മലയാളം' : 'English'}</span>
            </button>

            {/* Offline Simulator Pill */}
            <button
              onClick={() => setIsOffline((o) => !o)}
              className={`p-1.5 rounded-full border transition ${
                isOffline
                  ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                  : 'bg-emerald-800 border-emerald-600 text-emerald-300'
              }`}
              title={isOffline ? 'Offline mode (Click to go online)' : 'Online (Click to toggle offline simulation)'}
            >
              {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-lg font-bold font-display">{t.appName}</h1>
          <div className="flex items-center justify-between text-xs text-emerald-200 mt-0.5">
            <span className="font-medium">{t.driverName}</span>
            <span>{t.today}</span>
          </div>
        </div>
      </div>

      {/* Offline Queue Sync Bar if items queued */}
      {queuedTrips.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 p-2.5 px-4 flex items-center justify-between text-xs text-amber-900">
          <span className="font-semibold">
            {queuedTrips.length} offline trip(s) pending sync in IndexedDB
          </span>
          <button
            onClick={handleSyncNow}
            disabled={isSyncing || isOffline}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : t.syncNow}</span>
          </button>
        </div>
      )}

      {/* Main Form Body */}
      <div className="p-4 flex-1 space-y-4">
        {/* Vehicle & Assignment Card */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-600 tracking-wider block">
                {t.contract}
              </span>
              <h2 className="text-sm font-bold text-gray-900 font-mono">{t.vehicle}</h2>
            </div>
          </div>

          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              shiftState === 'on_trip'
                ? 'bg-emerald-800 text-white shadow-xs'
                : shiftState === 'completed'
                ? 'bg-blue-800 text-white shadow-xs'
                : 'bg-gray-800 text-white shadow-xs'
            }`}
          >
            {shiftState === 'on_trip' ? t.statusActive : shiftState === 'completed' ? t.statusFinished : t.statusIdle}
          </span>
        </div>

        {/* Live Metrics Meter if Shift Active or Completed */}
        {shiftState !== 'idle' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-950 text-emerald-300 p-3.5 rounded-xl shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-bold block flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5" />
                {t.totalKmRun}
              </span>
              <span className="text-2xl font-bold font-mono text-white mt-1 block">
                {computedKm} <span className="text-xs font-normal text-emerald-400">KM</span>
              </span>
            </div>

            <div className="bg-emerald-900 text-emerald-200 p-3.5 rounded-xl shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-bold block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {t.shiftDuration}
              </span>
              <span className="text-2xl font-bold font-mono text-white mt-1 block">
                13:30 <span className="text-xs font-normal text-emerald-300">HRS</span>
              </span>
            </div>
          </div>
        )}

        {/* Big Touch Targets Odometer Card */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 block flex items-center justify-between">
              <span>{t.startKmLabel}</span>
              <span className="text-[11px] font-medium text-gray-700">{startTime}</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={startKm}
                disabled={shiftState !== 'idle'}
                onChange={(e) => setStartKm(e.target.value)}
                className="w-full text-xl font-bold font-mono px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-600 min-h-[48px]"
                placeholder="155622"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 block flex items-center justify-between">
              <span>{t.closeKmLabel}</span>
              <span className="text-[11px] font-medium text-gray-700">{closeTime}</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={closeKm}
                onChange={(e) => setCloseKm(e.target.value)}
                className="w-full text-xl font-bold font-mono px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                placeholder="155670"
              />
            </div>
          </div>

          {/* Real Camera Capture & Image Preview */}
          <div className="pt-1">
            {photoDataUrl ? (
              <div className="relative border border-emerald-300 bg-emerald-50/50 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={photoDataUrl}
                    alt="Odometer preview"
                    className="w-14 h-14 object-cover rounded-lg border border-emerald-200"
                  />
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {t.photoUploaded}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Compressed: {photoSizeKb} KB
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPhotoDataUrl(null);
                    setPhotoSizeKb(null);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition"
                  title="Remove photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 px-3 border border-dashed border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition min-h-[48px]"
              >
                <Camera className="w-4 h-4 text-emerald-700" />
                <span>{t.takeOdoPhoto}</span>
              </button>
            )}
          </div>
        </div>

        {/* Allowances & Expenses Card */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
          <span className="text-[10px] uppercase font-bold text-gray-600 tracking-wider block">
            Bata & Additional Expenses
          </span>

          {/* Night Bata Toggle */}
          <label className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer min-h-[48px] select-none">
            <input
              type="checkbox"
              checked={nightBata}
              onChange={(e) => setNightBata(e.target.checked)}
              className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
            />
            <div className="flex-1">
              <span className="text-xs font-bold text-gray-900 block flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                {t.nightBataLabel}
              </span>
              <span className="text-[11px] text-gray-700 leading-tight block">{t.nightBataSub}</span>
            </div>
          </label>

          {/* Outstation Bata Toggle */}
          <label className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer min-h-[48px] select-none">
            <input
              type="checkbox"
              checked={outstationBata}
              onChange={(e) => setOutstationBata(e.target.checked)}
              className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
            />
            <div className="flex-1">
              <span className="text-xs font-bold text-gray-900 block flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                {t.outstationLabel}
              </span>
            </div>
          </label>

          {/* Toll & Parking */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 block flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-gray-400" />
              <span>{t.tollLabel}</span>
            </label>
            <input
              type="number"
              value={tollAmount}
              onChange={(e) => setTollAmount(e.target.value)}
              className="w-full text-sm font-mono px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 min-h-[44px]"
              placeholder="e.g. 600"
            />
          </div>

          {/* Route Remarks */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 block">
              <span>{t.routeLabel}</span>
            </label>
            <input
              type="text"
              value={routeNotes}
              onChange={(e) => setRouteNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 min-h-[44px]"
              placeholder="Site trips, Kattakada, Kanyakumari..."
            />
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar (48px+ Touch Target) */}
      <div className="p-4 bg-white border-t border-gray-200 sticky bottom-0 z-20 space-y-2">
        {shiftState === 'idle' ? (
          <button
            onClick={handleStartTrip}
            className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2 min-h-[48px]"
          >
            <Car className="w-5 h-5" />
            <span>{t.startTripBtn}</span>
          </button>
        ) : (
          <button
            onClick={handleFinishTrip}
            className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2 min-h-[48px]"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{t.finishTripBtn}</span>
          </button>
        )}

        <div className="flex items-center justify-between text-[11px] text-gray-700 pt-1">
          <span className="flex items-center gap-1">
            {isOffline ? (
              <>
                <WifiOff className="w-3 h-3 text-amber-500" />
                <span className="text-amber-700 font-semibold">{t.offlineStatus}</span>
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">{t.onlineStatus}</span>
              </>
            )}
          </span>

          <span className="text-[10px] text-gray-700 font-medium">
            {photoDataUrl ? 'Photo ready' : 'No photo'}
          </span>
        </div>
      </div>
    </div>
  );
};
