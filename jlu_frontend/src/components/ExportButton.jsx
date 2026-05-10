import { useState, useRef, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import Modal from './Modal'

/**
 * ExportButton – Unified flat draggable column list.
 *
 * Every column (generic, IA raw, IA scaled, IA total, IA weighted, ESE marks,
 * ESE weighted) is a first-class draggable row in a single ordered list.
 * Column order in the export exactly matches the order shown here.
 */
export default function ExportButton({
  title, filenamePrefix, dataRows, availableCols, courseInfo,
  iaComponents = [], courseWeightage = {}
}) {
  const [open, setOpen]     = useState(false)
  const [format, setFormat] = useState('pdf')
  const [includeSig, setIncludeSig] = useState(true)

  // Build the canonical flat column list
  function buildInitialCols() {
    const cols = []
    availableCols.forEach(c => cols.push({ key: c.key, label: c.label, enabled: true }))
    iaComponents.forEach(comp => {
      cols.push({ key: `ia_${comp.id}_raw`,    label: `${comp.name} Raw`,    sublabel: `/${comp.max_marks}`,    enabled: true  })
      cols.push({ key: `ia_${comp.id}_scaled`, label: `${comp.name} Scaled`, sublabel: `${comp.weightage}%`,   enabled: false })
    })
    if (iaComponents.length > 0) {
      cols.push({ key: 'ia_total_raw',    label: 'IA Total',          sublabel: 'sum of raw',                              enabled: true  })
      cols.push({ key: 'ia_total_scaled', label: 'IA Total Weighted', sublabel: `${courseWeightage.int_weightage ?? '?'}%`, enabled: false })
      cols.push({ key: 'ese_total',       label: 'ESE Marks',         sublabel: `/${courseWeightage.ese_max_marks ?? 100}`, enabled: true  })
      cols.push({ key: 'ese_scaled',      label: 'ESE Weighted',      sublabel: `${courseWeightage.ese_weightage ?? '?'}%`, enabled: false })
    }
    return cols
  }

  const [cols, setCols] = useState(buildInitialCols)
  useEffect(() => { setCols(buildInitialCols()) }, [iaComponents.length]) // eslint-disable-line

  // Drag
  const dragIdx  = useRef(null)
  const overIdx  = useRef(null)
  const [, tick] = useState(0)

  function onDragStart(i) { dragIdx.current = i }
  function onDragEnter(i) { overIdx.current = i; tick(n => n + 1) }
  function onDragEnd() {
    const from = dragIdx.current, to = overIdx.current
    if (from != null && to != null && from !== to) {
      const next = [...cols]; const [m] = next.splice(from, 1); next.splice(to, 0, m); setCols(next)
    }
    dragIdx.current = overIdx.current = null; tick(n => n + 1)
  }

  function toggle(idx) { setCols(prev => prev.map((c, i) => i === idx ? { ...c, enabled: !c.enabled } : c)) }

  function toggleAllIA(which) {
    const keys  = iaComponents.map(comp => `ia_${comp.id}_${which}`)
    const allOn = keys.every(k => cols.find(c => c.key === k)?.enabled)
    setCols(prev => prev.map(c => keys.includes(c.key) ? { ...c, enabled: !allOn } : c))
  }

  function getValue(row, col) {
    if (col.key in row) return row[col.key]
    const raw = col.key.match(/^ia_(\d+)_raw$/)
    if (raw) return row[`ia_${raw[1]}`] ?? '—'
    return '—'
  }

  function buildExportData() {
    const active  = cols.filter(c => c.enabled)
    const headers = active.map(c => c.sublabel ? `${c.label} (${c.sublabel})` : c.label)
    const rows    = dataRows.map(row => active.map(c => getValue(row, c)))
    return { headers, exportData: rows }
  }

  function handleExport() {
    const { headers, exportData } = buildExportData()
    const filename = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}`
    if (format === 'csv') {
      const txt = [headers, ...exportData].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n')
      Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([txt], { type: 'text/csv' })), download: `${filename}.csv`,
      }).click()
    } else if (format === 'xlsx') {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...exportData]), 'Sheet1')
      XLSX.writeFile(wb, `${filename}.xlsx`)
    } else {
      const doc = new jsPDF({ orientation: headers.length > 8 ? 'l' : 'p' })
      doc.setFontSize(14); doc.text(`${courseInfo.code} — ${courseInfo.name}`, 14, 15)
      doc.setFontSize(10); doc.text(title, 14, 22)
      autoTable(doc, { head: [headers], body: exportData, startY: 28, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [40, 40, 40] } })
      if (includeSig) { const y = doc.lastAutoTable.finalY || 28; doc.text('Date: _________________', 14, y + 30); doc.text('Faculty Signature: _________________', 120, y + 30) }
      doc.save(`${filename}.pdf`)
    }
    setOpen(false)
  }

  const sl  = { fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, display: 'block' }
  const cs  = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }
  const hasIA = iaComponents.length > 0

  function rowBg(key) {
    if (/^ia_\d+_raw$/.test(key))    return 'rgba(100,180,255,0.09)'
    if (/^ia_\d+_scaled$/.test(key)) return 'rgba(100,220,180,0.09)'
    if (['ia_total_raw','ia_total_scaled','ese_total','ese_scaled'].includes(key)) return 'rgba(200,160,255,0.09)'
    return 'transparent'
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>↓ Export</button>

      {open && (
        <Modal title={`Export: ${title}`} onClose={() => setOpen(false)} width={560}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0' }}>

            {/* Format */}
            <div>
              <span style={sl}>Format</span>
              <div style={{ display: 'flex', gap: 14 }}>
                {['pdf', 'xlsx', 'csv'].map(f => (
                  <label key={f} style={cs}><input type="radio" value={f} checked={format === f} onChange={e => setFormat(e.target.value)} />{f.toUpperCase()}</label>
                ))}
              </div>
            </div>

            {/* Column picker */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ ...sl, marginBottom: 0 }}>Columns</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>⠿ drag to reorder</span>
              </div>

              {hasIA && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  {[
                    { bg: 'rgba(100,180,255,0.22)', label: 'IA Raw' },
                    { bg: 'rgba(100,220,180,0.22)', label: 'IA Scaled' },
                    { bg: 'rgba(200,160,255,0.22)', label: 'Totals / ESE' },
                  ].map(({ bg, label }) => (
                    <span key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text3)' }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:bg, display:'inline-block' }} />
                      {label}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 390, overflowY: 'auto' }}>
                {cols.map((col, idx) => {
                  const isOver = overIdx.current === idx && dragIdx.current !== idx
                  return (
                    <div
                      key={col.key}
                      draggable
                      onDragStart={() => onDragStart(idx)}
                      onDragEnter={() => onDragEnter(idx)}
                      onDragEnd={onDragEnd}
                      onDragOver={e => e.preventDefault()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px',
                        borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                        background: isOver ? 'var(--surface2)' : rowBg(col.key),
                        borderLeft: isOver ? '3px solid var(--accent)' : '3px solid transparent',
                        transition: 'background 0.1s',
                        opacity: col.enabled ? 1 : 0.5,
                      }}
                    >
                      <span style={{ cursor:'grab', color:'var(--text3)', fontSize:15, userSelect:'none', padding:'0 4px' }}>⠿</span>
                      <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', flex:1, margin:0, fontWeight: col.enabled ? 500 : 400 }}>
                        <input type="checkbox" checked={col.enabled} onChange={() => toggle(idx)} />
                        {col.label}
                        {col.sublabel && <span style={{ color:'var(--text3)', fontSize:11 }}>({col.sublabel})</span>}
                      </label>
                    </div>
                  )
                })}
              </div>

              {hasIA && (
                <div style={{ display:'flex', gap:10, marginTop:7, flexWrap:'wrap' }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => toggleAllIA('raw')}>Toggle all Raw</button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => toggleAllIA('scaled')}>Toggle all Scaled</button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => setCols(buildInitialCols())}>Reset</button>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <span style={sl}>Options</span>
              <label style={cs}>
                <input type="checkbox" checked={includeSig} onChange={e => setIncludeSig(e.target.checked)} disabled={format !== 'pdf'} />
                Include blank Date &amp; Signature line (PDF only)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExport} disabled={!cols.some(c => c.enabled)}>↓ Download</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
