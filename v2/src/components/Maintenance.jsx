// Reusable "not built yet" placeholder — used for Settings sub-panels whose
// backend doesn't exist yet (Risk Management, Asset Screener, Alerts,
// Economic Calendar). Ports module_under_maintenance.html.
export default function Maintenance({ label, onReturn }) {
  return (
    <div className="qc-maintenance h-full flex items-center justify-center p-xl relative overflow-hidden">
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-10 pointer-events-none">
        <span className="material-symbols-outlined text-[30vw] text-secondary">engineering</span>
      </div>
      <div className="absolute top-0 left-0 w-1/3 h-1/3 bg-primary-fixed/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-1/3 h-1/3 bg-secondary/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-[520px]">
        <div className="glass-panel p-xl flex flex-col items-center text-center">
          <div className="w-20 h-20 mb-lg flex items-center justify-center border-2 border-secondary bg-surface-container-low shadow-[4px_4px_0px_0px_#000000]">
            <span className="material-symbols-outlined text-[40px] text-secondary animate-pulse">construction</span>
          </div>

          <div className="mb-md w-full border-b-2 border-outline-variant pb-md">
            <h1 className="font-display-lg text-[24px] font-black text-primary uppercase tracking-tighter">
              Module Under Maintenance
            </h1>
          </div>

          <p className="font-body-base text-body-base text-on-surface-variant max-w-[400px] mb-lg leading-relaxed">
            {label ? <>The <span className="text-secondary font-bold">{label}</span> module</> : 'This module'} is not
            yet backed by a live data source. It'll come online once the connected feature ships. Check back shortly, operator.
          </p>

          <div className="grid grid-cols-2 gap-sm w-full max-w-[400px] mb-lg">
            <div className="bg-surface-container-low p-sm border-2 border-outline-variant flex flex-col items-start">
              <span className="font-label-caps text-label-caps text-secondary uppercase mb-xs">Status Code</span>
              <span className="font-stat-lg text-stat-lg text-primary">503</span>
            </div>
            <div className="bg-surface-container-low p-sm border-2 border-outline-variant flex flex-col items-start">
              <span className="font-label-caps text-label-caps text-secondary uppercase mb-xs">Backend</span>
              <span className="font-stat-lg text-stat-lg text-primary">PENDING</span>
            </div>
          </div>

          {onReturn && (
            <button
              onClick={onReturn}
              className="bg-primary-fixed text-on-primary-fixed border-2 border-black font-body-bold text-body-bold px-xl py-md w-full max-w-[400px] flex items-center justify-center gap-sm shadow-[4px_4px_0px_0px_#c3f400] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_0px_#c3f400] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all uppercase tracking-wide"
            >
              <span className="material-symbols-outlined">terminal</span>
              Return to Terminal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
