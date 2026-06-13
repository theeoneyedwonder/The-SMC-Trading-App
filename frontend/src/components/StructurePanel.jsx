const TFS = ['D1', 'H4', 'H1', 'M30', 'M15', 'M5', 'M1'];

export default function StructurePanel({ indicators }) {
  return (
    <div className="panel structure-panel">
      <div className="panel-title">Market Structure</div>
      <div className="structure-list">
        {TFS.map(tf => {
          const d = indicators?.[tf];
          return (
            <div key={tf} className="structure-row">
              <span className="tf-label">{tf}</span>
              {d ? (
                <>
                  <span className={`bias-badge ${d.bias.toLowerCase()}`}>{d.bias}</span>
                  <span className={`trend-text ${d.structure.trend.toLowerCase()}`}>
                    {d.structure.trend}
                  </span>
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
