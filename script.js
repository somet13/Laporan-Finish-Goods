/* =========================================================
   FG REPORT SYSTEM - CONCORD
   Warehouse = master
   Packing/QC = reference ke Warehouse
   Admin = rekap Warehouse tanpa membedakan shift
========================================================= */

const DB = {
  warehouse: 'fg_concord_warehouse_v1',
  packing: 'fg_concord_packing_v1',
  admin: 'fg_concord_admin_v1'
};

const CAPACITY = {
  '25x50': 96,
  '50x50': 80,
  '60x60': 40,
  '60x120': 64
};

const SIZE_ORDER = ['25x50', '50x50', '60x60', '60x120'];

let warehouse = [];
let packing = [];
let admin = [];
let productionChart = null;
let qualityChart = null;

const $ = id => document.getElementById(id);
const toNum = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = value => toNum(value).toLocaleString('id-ID');
const normText = value => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
const normSize = value => String(value ?? '').replace(/\s+/g, '').toLowerCase();

const sizeLabel = value => ({
  '25x50': '25 x 50',
  '50x50': '50 x 50',
  '60x60': '60 x 60',
  '60x120': '60 x 120'
}[normSize(value)] || '-');

const sizeIndex = value => {
  const i = SIZE_ORDER.indexOf(normSize(value));
  return i < 0 ? 999 : i;
};

const makeId = prefix =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;


function today() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}


function esc(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}


function readStorage(key) {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(key) || '[]'
    );

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch {
    return [];
  }
}


function saveAll() {
  localStorage.setItem(
    DB.warehouse,
    JSON.stringify(warehouse)
  );

  localStorage.setItem(
    DB.packing,
    JSON.stringify(packing)
  );

  localStorage.setItem(
    DB.admin,
    JSON.stringify(admin)
  );
}


function sizeClass(value) {
  return ({
    '25x50': 'size-25x50',
    '50x50': 'size-50x50',
    '60x60': 'size-60x60',
    '60x120': 'size-60x120'
  }[normSize(value)] || 'size-default');
}


function sizeBadge(value) {
  return `<span class="size-badge ${sizeClass(value)}">${esc(sizeLabel(value))}</span>`;
}


function groupHeader(size) {
  const s = normSize(size);

  return `
    <tr class="size-group-row">
      <td colspan="20">
        <div class="size-group-header size-group-${s}">
          ${sizeBadge(s)}
          <strong>
            LAPORAN UKURAN ${esc(sizeLabel(s))}
          </strong>
          <span>
            ${fmt(CAPACITY[s] || 0)} Box / Palet
          </span>
        </div>
      </td>
    </tr>
  `;
}


function calculateTotal(
  palet,
  rimpilan,
  size
) {
  return (
    toNum(palet) *
    (CAPACITY[normSize(size)] || 0)
  ) + toNum(rimpilan);
}


function emptyQuality() {
  return {
    palet: 0,
    rimpilan: 0,
    total: 0
  };
}


/* =========================================================
   MIGRASI DATA LAMA / NORMALISASI
========================================================= */

function normalizeWarehouse(row) {

  const size =
    normSize(row.ukuran);

  const capacity =
    CAPACITY[size] || 0;


  if (
    row.kualitas &&
    typeof row.kualitas === 'object'
  ) {

    const q1 =
      row.kualitas.s1 || {};

    const q2 =
      row.kualitas.s2 || {};

    const q3 =
      row.kualitas.kw3 || {};


    const s1 = {

      palet:
        toNum(q1.palet),

      rimpilan:
        toNum(q1.rimpilan),

      total:
        0

    };


    const s2 = {

      palet:
        toNum(q2.palet),

      rimpilan:
        toNum(q2.rimpilan),

      total:
        0

    };


    const kw3 = {

      palet:
        toNum(q3.palet),

      rimpilan:
        toNum(q3.rimpilan),

      total:
        0

    };


    s1.total =
      s1.palet * capacity +
      s1.rimpilan;


    s2.total =
      s2.palet * capacity +
      s2.rimpilan;


    kw3.total =
      kw3.palet * capacity +
      kw3.rimpilan;


    return {

      id:
        row.id ||
        makeId('w'),

      tanggal:
        row.tanggal || '',

      sppj:
        row.sppj ||
        row.noSPPJ ||
        '',

      merek:
        row.merek ||
        row.namaMerek ||
        '',

      motif:
        row.motif ||
        '',

      kodeProduksi:
        row.kodeProduksi ||
        '',

      seri:
        row.seri ??
        '',

      ukuran:
        size,

      shift:
        row.shift ||
        row.shiftInput ||
        '',

      status:
        row.status ||
        'SESUAI',

      tanggalInput:
        row.tanggalInput ||
        row.tglInput ||
        '',

      kualitas: {
        s1,
        s2,
        kw3
      },

      total:
        s1.total +
        s2.total +
        kw3.total

    };

  }


  const quality =
    normText(row.kualitas);


  const palet =
    toNum(row.palet);


  const rimpilan =
    toNum(row.rimpilan);


  const storedTotal =
    Number(
      row.totalBox
    );


  const total =
    Number.isFinite(
      storedTotal
    )
      ? storedTotal
      : palet * capacity +
        rimpilan;


  const result = {

    id:
      row.id ||
      makeId('w'),

    tanggal:
      row.tanggal ||
      '',

    sppj:
      row.sppj ||
      row.noSPPJ ||
      '',

    merek:
      row.merek ||
      row.namaMerek ||
      '',

    motif:
      row.motif ||
      '',

    kodeProduksi:
      row.kodeProduksi ||
      '',

    seri:
      row.seri ??
      '',

    ukuran:
      size,

    shift:
      row.shift ||
      row.shiftInput ||
      '',

    status:
      row.status ||
      'SESUAI',

    tanggalInput:
      row.tanggalInput ||
      row.tglInput ||
      '',

    kualitas: {

      s1:
        emptyQuality(),

      s2:
        emptyQuality(),

      kw3:
        emptyQuality()

    },

    total:
      0

  };


  if (
    quality === 'S1'
  ) {

    result.kualitas.s1 = {

      palet,

      rimpilan,

      total

    };

  }


  if (
    quality === 'S2'
  ) {

    result.kualitas.s2 = {

      palet,

      rimpilan,

      total

    };

  }


  if (
    quality === 'KW3'
  ) {

    result.kualitas.kw3 = {

      palet,

      rimpilan,

      total

    };

  }


  result.total =

    result.kualitas.s1.total +

    result.kualitas.s2.total +

    result.kualitas.kw3.total;


  return result;
}


function normalizePacking(row) {

  return {

    id:
      row.id ||
      makeId('p'),

    masterId:
      String(
        row.masterId ||
        ''
      ),

    tanggalProduksi:
      row.tanggalProduksi ||
      row.tanggal ||
      '',

    keterangan:
      row.keterangan ||
      'OK',

    tanggalInput:
      row.tanggalInput ||
      '',

    shift:
      row.shift ||
      row.shiftInput ||
      ''

  };

}


function normalizeAdmin(row) {

  const s1 =
    toNum(
      row.s1 ??
      row.totalS1
    );


  const s2 =
    toNum(
      row.s2 ??
      row.totalS2
    );


  const kw3 =
    toNum(
      row.kw3 ??
      row.totalKW3
    );


  return {

    id:
      row.id ||
      makeId('a'),

    tanggal:
      row.tanggal ||
      '',

    kodeProduksi:
      row.kodeProduksi ||
      '',

    motif:
      row.motif ||
      '',

    merek:
      row.merek ||
      row.namaMerek ||
      '',

    seri:
      row.seri ??
      '',

    ukuran:
      normSize(
        row.ukuran
      ),

    s1,
    s2,
    kw3,

    total:
      s1 +
      s2 +
      kw3

  };

}


function migrateOldWarehouse(
  rows
) {

  const map =
    new Map();


  rows
    .map(
      normalizeWarehouse
    )
    .forEach(
      row => {

        const key =
          [

            row.tanggal,

            normText(
              row.sppj
            ),

            normText(
              row.merek
            ),

            normText(
              row.motif
            ),

            normText(
              row.kodeProduksi
            ),

            normText(
              row.seri
            ),

            normSize(
              row.ukuran
            ),

            normText(
              row.shift
            )

          ].join(
            '|'
          );


        if (
          !map.has(key)
        ) {

          map.set(
            key,
            {

              ...row,

              kualitas: {

                s1:
                  emptyQuality(),

                s2:
                  emptyQuality(),

                kw3:
                  emptyQuality()

              },

              total:
                0

            }
          );

        }


        const target =
          map.get(
            key
          );


        [
          's1',
          's2',
          'kw3'

        ]
        .forEach(
          q => {

            target.kualitas[q]
              .palet +=
              toNum(
                row.kualitas[q].palet
              );


            target.kualitas[q]
              .rimpilan +=
              toNum(
                row.kualitas[q]
                  .rimpilan
              );


            target.kualitas[q]
              .total +=
              toNum(
                row.kualitas[q]
                  .total
              );

          }
        );


        target.total =

          target.kualitas.s1.total +

          target.kualitas.s2.total +

          target.kualitas.kw3.total;

      }
    );


  return [
    ...map.values()
  ];

}


function loadAll() {

  let w =
    readStorage(
      DB.warehouse
    );


  let p =
    readStorage(
      DB.packing
    );


  let a =
    readStorage(
      DB.admin
    );


  if (
    !w.length
  ) {

    for (
      const key of [

        'fg_report_warehouse_concord_v5',

        'fg_report_warehouse_concord_v4',

        'fg_report_warehouse_concord_v3'

      ]
    ) {

      const old =
        readStorage(
          key
        );


      if (
        old.length
      ) {

        w =
          old;

        break;

      }

    }

  }


  if (
    !p.length
  ) {

    for (
      const key of [

        'fg_report_packing_concord_v5',

        'fg_report_packing_concord_v4',

        'fg_report_packing_concord_v3'

      ]
    ) {

      const old =
        readStorage(
          key
        );


      if (
        old.length
      ) {

        p =
          old;

        break;

      }

    }

  }


  if (
    !a.length
  ) {

    for (
      const key of [

        'fg_report_admin_concord_v5',

        'fg_report_admin_concord_v4',

        'fg_report_admin_concord_v3'

      ]
    ) {

      const old =
        readStorage(
          key
        );


      if (
        old.length
      ) {

        a =
          old;

        break;

      }

    }

  }


  const hasNewWarehouse =
    w.some(
      x =>
        x.kualitas &&
        typeof x.kualitas ===
        'object'
    );


  warehouse =
    hasNewWarehouse
      ? w.map(
          normalizeWarehouse
        )
      : migrateOldWarehouse(
          w
        );


  packing =
    p.map(
      normalizePacking
    );


  admin =
    a.map(
      normalizeAdmin
    );


  cleanOrphanPacking();


  saveAll();

}


function cleanOrphanPacking() {

  const valid =
    new Set(
      warehouse.map(
        w =>
          String(
            w.id
          )
      )
    );


  packing =
    packing.filter(
      p =>
        valid.has(
          String(
            p.masterId
          )
        )
    );

}


/* =========================================================
   NAVIGASI / MODAL
========================================================= */

document
  .querySelectorAll(
    '.nav-item'
  )
  .forEach(
    btn => {

      btn.addEventListener(
        'click',
        () => {

          document
            .querySelectorAll(
              '.nav-item'
            )
            .forEach(
              x =>
                x.classList.toggle(
                  'active',
                  x === btn
                )
            );


          document
            .querySelectorAll(
              '.content-section'
            )
            .forEach(
              x =>
                x.classList.toggle(
                  'active',
                  x.id ===
                  btn.dataset.section
                )
            );


          const sec =
            btn.dataset.section;


          if (
            sec ===
            'dashboard'
          ) {

            renderDashboard();

          }


          if (
            sec ===
            'warehouse'
          ) {

            renderWarehouse();

          }


          if (
            sec ===
            'packing'
          ) {

            renderPacking();

          }


          if (
            sec ===
            'admin'
          ) {

            renderAdmin();

          }

        }
      );

    }
  );


document
  .querySelectorAll(
    '[data-close]'
  )
  .forEach(
    btn => {

      btn.addEventListener(
        'click',
        () =>
          closeModal(
            btn.dataset.close
          )
      );

    }
  );


document
  .querySelectorAll(
    '.modal'
  )
  .forEach(
    modal => {

      modal.addEventListener(
        'click',
        e => {

          if (
            e.target ===
            modal
          ) {

            modal.classList.remove(
              'show'
            );

          }

        }
      );

    }
  );


document.addEventListener(
  'keydown',
  e => {

    if (
      e.key ===
      'Escape'
    ) {

      [

        'warehouseModal',

        'packingModal',

        'adminModal'

      ]
      .forEach(
        closeModal
      );

    }

  }
);


function openModal(
  id
) {

  $(id)
    .classList
    .add(
      'show'
    );

}


function closeModal(
  id
) {

  const el =
    $(id);


  if (
    el
  ) {

    el.classList.remove(
      'show'
    );

  }

}


/* =========================================================
   DASHBOARD
========================================================= */

function getDailyData(
  startDate = '',
  endDate = ''
) {

  const map =
    new Map();


  warehouse.forEach(
    row => {

      if (
        !row.tanggal
      ) {

        return;

      }


      if (
        startDate &&
        row.tanggal <
        startDate
      ) {

        return;

      }


      if (
        endDate &&
        row.tanggal >
        endDate
      ) {

        return;

      }


      if (
        !map.has(
          row.tanggal
        )
      ) {

        map.set(
          row.tanggal,
          {

            date:
              row.tanggal,

            s1:
              0,

            s2:
              0,

            kw3:
              0,

            total:
              0

          }
        );

      }


      const day =
        map.get(
          row.tanggal
        );


      day.s1 +=
        toNum(
          row.kualitas?.s1?.total
        );


      day.s2 +=
        toNum(
          row.kualitas?.s2?.total
        );


      day.kw3 +=
        toNum(
          row.kualitas?.kw3?.total
        );


      day.total =

        day.s1 +

        day.s2 +

        day.kw3;

    }
  );


  return [
    ...map.values()
  ]
  .sort(
    (a,b) =>
      a.date.localeCompare(
        b.date
      )
  );

}


function chartDate(
  value
) {

  return new Date(
    `${value}T00:00:00`
  )
  .toLocaleDateString(
    'id-ID',
    {

      day:
        '2-digit',

      month:
        'short'

    }
  );

}


function longDate(
  value
) {

  return new Date(
    `${value}T00:00:00`
  )
  .toLocaleDateString(
    'id-ID',
    {

      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric'

    }
  );

}


function renderLegend() {

  $(
    'dashboardLegend'
  ).innerHTML =

    SIZE_ORDER
      .map(
        size => `

          <div
            class="size-legend-item"
          >

            ${sizeBadge(
              size
            )}

            <span>
              ${fmt(
                CAPACITY[size]
              )}
              Box / Palet
            </span>

          </div>

        `
      )
      .join('');

}


function renderQualitySummary(
  s1,
  s2,
  kw3
) {

  const total =
    s1 +
    s2 +
    kw3;


  const pct =
    value =>
      total
        ? (
            (
              value /
              total
            ) *
            100
          ).toFixed(
            1
          )
        : '0.0';


  const items = [

    [
      'S1',
      s1,
      '#0b8f68'
    ],

    [
      'S2',
      s2,
      '#eab308'
    ],

    [
      'KW3',
      kw3,
      '#ef4444'
    ]

  ];


  $(
    'qualitySummary'
  ).innerHTML =

    items
      .map(
        ([q,v,c]) => `

          <div
            class="quality-summary-item"
          >

            <div
              class="quality-summary-left"
            >

              <span
                class="quality-dot"
                style="background:${c}"
              ></span>

              <span>
                ${q}
              </span>

            </div>

            <b>
              ${fmt(
                v
              )}
              Box ·
              ${pct(
                v
              )}%
            </b>

          </div>

        `
      )
      .join('');

}


function renderDailySummary(
  rows
) {

  const box =
    $(
      'dailySummaryGrid'
    );


  if (
    !rows.length
  ) {

    box.innerHTML =
      '<div class="empty-state">Belum ada data produksi pada periode ini.</div>';

    return;

  }


  box.innerHTML =

    [
      ...rows
    ]
      .reverse()
      .map(
        row => `

          <div
            class="daily-card"
          >

            <div
              class="daily-head"
            >

              <strong>
                ${longDate(
                  row.date
                )}
              </strong>

              <b>
                ${fmt(
                  row.total
                )}
              </b>

            </div>


            <div
              class="daily-row"
            >

              <span>
                S1
              </span>

              <strong>
                ${fmt(
                  row.s1
                )}
              </strong>

            </div>


            <div
              class="daily-row"
            >

              <span>
                S2
              </span>

              <strong>
                ${fmt(
                  row.s2
                )}
              </strong>

            </div>


            <div
              class="daily-row"
            >

              <span>
                KW3
              </span>

              <strong>
                ${fmt(
                  row.kw3
                )}
              </strong>

            </div>

          </div>

        `
      )
      .join('');

}


function setDashboardDefaults() {

  const dates =
    warehouse
      .map(
        x =>
          x.tanggal
      )
      .filter(
        Boolean
      )
      .sort();


  $(
    'dashboardStartDate'
  ).value =
    dates[0] ||
    today();


  $(
    'dashboardEndDate'
  ).value =
    dates.at(-1) ||
    today();

}


function updateDashboardCharts() {

  if (
    typeof Chart ===
    'undefined'
  ) {

    return;

  }


  const start =
    $(
      'dashboardStartDate'
    ).value;


  const end =
    $(
      'dashboardEndDate'
    ).value;


  const rows =
    getDailyData(
      start,
      end
    );


  const labels =
    rows.map(
      x =>
        chartDate(
          x.date
        )
    );


  if (
    productionChart
  ) {

    productionChart.destroy();

  }


  if (
    qualityChart
  ) {

    qualityChart.destroy();

  }


  productionChart =
    new Chart(
      $(
        'productionChart'
      ),
      {

        type:
          'line',

        data: {

          labels,

          datasets: [

            {

              label:
                'S1',

              data:
                rows.map(
                  x =>
                    x.s1
                ),

              borderColor:
                '#0b8f68',

              backgroundColor:
                'rgba(11,143,104,.10)',

              fill:
                true,

              tension:
                .35,

              pointRadius:
                4,

              borderWidth:
                3

            },


            {

              label:
                'S2',

              data:
                rows.map(
                  x =>
                    x.s2
                ),

              borderColor:
                '#eab308',

              backgroundColor:
                'rgba(234,179,8,.08)',

              fill:
                true,

              tension:
                .35,

              pointRadius:
                4,

              borderWidth:
                3

            },


            {

              label:
                'KW3',

              data:
                rows.map(
                  x =>
                    x.kw3
                ),

              borderColor:
                '#ef4444',

              backgroundColor:
                'rgba(239,68,68,.07)',

              fill:
                true,

              tension:
                .35,

              pointRadius:
                4,

              borderWidth:
                3

            }

          ]

        },

        options: {

          responsive:
            true,

          maintainAspectRatio:
            false,

          interaction: {

            intersect:
              false,

            mode:
              'index'

          },

          plugins: {

            legend: {

              position:
                'bottom',

              labels: {

                usePointStyle:
                  true

              }

            },

            tooltip: {

              callbacks: {

                label:
                  c =>
                    `${c.dataset.label}: ${fmt(c.parsed.y)} Box`

              }

            }

          },

          scales: {

            y: {

              beginAtZero:
                true,

              ticks: {

                callback:
                  v =>
                    fmt(v)

              }

            },

            x: {

              grid: {

                display:
                  false

              }

            }

          }

        }

      }
    );


  const totals = [

    rows.reduce(
      (
        sum,
        x
      ) =>
        sum +
        toNum(
          x.s1
        ),
      0
    ),

    rows.reduce(
      (
        sum,
        x
      ) =>
        sum +
        toNum(
          x.s2
        ),
      0
    ),

    rows.reduce(
      (
        sum,
        x
      ) =>
        sum +
        toNum(
          x.kw3
        ),
      0
    )

  ];


  qualityChart =
    new Chart(
      $(
        'qualityChart'
      ),
      {

        type:
          'doughnut',

        data: {

          labels: [

            'S1',

            'S2',

            'KW3'

          ],

          datasets: [

            {

              data:
                totals,

              backgroundColor: [

                '#0b8f68',

                '#eab308',

                '#ef4444'

              ],

              borderColor:
                '#fff',

              borderWidth:
                3

            }

          ]

        },

        options: {

          responsive:
            true,

          maintainAspectRatio:
            false,

          cutout:
            '68%',

          plugins: {

            legend: {

              position:
                'bottom',

              labels: {

                usePointStyle:
                  true

              }

            },

            tooltip: {

              callbacks: {

                label:
                  c =>
                    `${c.label}: ${fmt(c.parsed)} Box`

              }

            }

          }

        }

      }
    );


  $(
    'dashboardMaster'
  ).textContent =

    fmt(
      warehouse.filter(
        x =>
          (
            !start ||
            x.tanggal >=
            start
          )
          &&
          (
            !end ||
            x.tanggal <=
            end
          )
      ).length
    );


  $(
    'dashboardS1'
  ).textContent =
    fmt(
      totals[0]
    );


  $(
    'dashboardS2'
  ).textContent =
    fmt(
      totals[1]
    );


  $(
    'dashboardKW3'
  ).textContent =
    fmt(
      totals[2]
    );


  $(
    'dashboardTotal'
  ).textContent =
    fmt(
      totals.reduce(
        (
          a,
          b
        ) =>
          a + b,
        0
      )
    );


  renderQualitySummary(
    ...totals
  );


  renderDailySummary(
    rows
  );

}


function renderDashboard() {

  $(
    'dashboardDate'
  ).textContent =

    new Date()
      .toLocaleDateString(
        'id-ID',
        {

          day:
            '2-digit',

          month:
            'long',

          year:
            'numeric'

        }
      );


  if (
    !$(
      'dashboardStartDate'
    ).value
  ) {

    setDashboardDefaults();

  }


  renderLegend();


  updateDashboardCharts();

}


$(
  'applyDashboardBtn'
)
.addEventListener(
  'click',
  updateDashboardCharts
);


$(
  'resetDashboardBtn'
)
.addEventListener(
  'click',
  () => {

    setDashboardDefaults();

    updateDashboardCharts();

  }
);


/* =========================================================
   WAREHOUSE
========================================================= */

function warehouseSort(
  rows
) {

  return rows.sort(
    (
      a,
      b
    ) =>

      sizeIndex(
        a.ukuran
      ) -
      sizeIndex(
        b.ukuran
      )

      ||

      normText(
        a.merek
      ).localeCompare(
        normText(
          b.merek
        )
      )

      ||

      normText(
        a.kodeProduksi
      ).localeCompare(
        normText(
          b.kodeProduksi
        )
      )

      ||

      normText(
        a.motif
      ).localeCompare(
        normText(
          b.motif
        )
      )

      ||

      normText(
        a.seri
      ).localeCompare(
        normText(
          b.seri
        )
      )

      ||

      normText(
        a.shift
      ).localeCompare(
        normText(
          b.shift
        )
      )

  );

}


function renderWarehouseStats() {

  const s1 =
    warehouse.reduce(
      (
        sum,
        x
      ) =>
        sum +
        toNum(
          x.kualitas.s1.total
        ),
      0
    );


  const s2 =
    warehouse.reduce(
      (
        sum,
        x
      ) =>
        sum +
        toNum(
          x.kualitas.s2.total
        ),
      0
    );


  const kw3 =
    warehouse.reduce(
      (
        sum,
        x
      ) =>
        sum +
        toNum(
          x.kualitas.kw3.total
        ),
      0
    );


  $(
    'warehouseCount'
  ).textContent =
    fmt(
      warehouse.length
    );


  $(
    'warehouseS1'
  ).textContent =
    fmt(
      s1
    );


  $(
    'warehouseS2'
  ).textContent =
    fmt(
      s2
    );


  $(
    'warehouseKW3'
  ).textContent =
    fmt(
      kw3
    );


  $(
    'warehouseTotal'
  ).textContent =
    fmt(
      s1 +
      s2 +
      kw3
    );

}


function renderWarehouseTable() {

  const q =
    normText(
      $(
        'warehouseSearch'
      ).value
    );


  const rows =
    warehouse.filter(
      x =>
        [

          x.tanggal,

          x.sppj,

          x.merek,

          x.motif,

          x.kodeProduksi,

          x.seri,

          x.ukuran,

          x.shift,

          x.status

        ]
        .join(
          ' '
        )
        .toUpperCase()
        .includes(
          q
        )
    );


  warehouseSort(
    rows
  );


  if (
    !rows.length
  ) {

    $(
      'warehouseTableBody'
    ).innerHTML =

      `
        <tr>
          <td
            colspan="16"
            class="empty-state"
          >
            Belum ada data Warehouse.
          </td>
        </tr>
      `;

    return;

  }


  let html =
    '';

  let lastSize =
    null;

  let no =
    0;


  rows.forEach(
    x => {

      const size =
        normSize(
          x.ukuran
        );


      if (
        size !==
        lastSize
      ) {

        html +=
          groupHeader(
            size
          );


        lastSize =
          size;

      }


      no++;


      const statusClass =

        normText(
          x.status
        ) ===
        'SESUAI'

          ?

        'badge-success'

          :

        'badge-danger';


      html += `

        <tr>

          <td>
            ${no}
          </td>

          <td>
            ${esc(
              x.tanggal
            )}
          </td>

          <td>
            ${esc(
              x.sppj
            )}
          </td>

          <td>
            <b>
              ${esc(
                x.merek
              )}
            </b>
          </td>

          <td>
            ${esc(
              x.motif
            )}
          </td>

          <td>
            ${esc(
              x.kodeProduksi
            )}
          </td>

          <td>
            ${esc(
              x.seri
            )}
          </td>

          <td>
            ${sizeBadge(
              x.ukuran
            )}
          </td>

          <td>
            ${esc(
              x.shift
            )}
          </td>

          <td>
            ${fmt(
              x.kualitas.s1.total
            )}
          </td>

          <td>
            ${fmt(
              x.kualitas.s2.total
            )}
          </td>

          <td>
            ${fmt(
              x.kualitas.kw3.total
            )}
          </td>

          <td>
            <b>
              ${fmt(
                x.total
              )}
            </b>
          </td>

          <td>
            <span
              class="badge ${statusClass}"
            >
              ${esc(
                x.status
              )}
            </span>
          </td>

          <td>
            ${esc(
              x.tanggalInput
            )}
          </td>

          <td>

            <div
              class="action-group"
            >

              <button
                class="action-btn edit"
                data-edit-w="${esc(
                  x.id
                )}"
              >
                Edit
              </button>

              <button
                class="action-btn delete"
                data-del-w="${esc(
                  x.id
                )}"
              >
                Hapus
              </button>

            </div>

          </td>

        </tr>

      `;

    }
  );


  $(
    'warehouseTableBody'
  ).innerHTML =
    html;

}


function renderWarehouse() {

  renderWarehouseStats();

  renderWarehouseTable();

  populatePackingMaster();

}


function resetWarehouseQuality() {

  [

    's1Palet',

    's1Rimpilan',

    's2Palet',

    's2Rimpilan',

    'kw3Palet',

    'kw3Rimpilan'

  ]
  .forEach(
    id => {

      $(id).value =
        0;

    }
  );

}


function openWarehouseModal(
  editId = ''
) {

  $(
    'warehouseForm'
  ).reset();


  $(
    'warehouseId'
  ).value =
    '';


  $(
    'warehouseTanggal'
  ).value =
    today();


  $(
    'warehouseTanggalInput'
  ).value =
    today();


  $(
    'warehouseStatus'
  ).value =
    'SESUAI';


  resetWarehouseQuality();


  $(
    'warehouseModalTitle'
  ).textContent =
    'Tambah Master Warehouse';


  if (
    editId
  ) {

    const x =
      warehouse.find(
        row =>
          String(
            row.id
          ) ===
          String(
            editId
          )
      );


    if (
      !x
    ) {

      return;

    }


    $(
      'warehouseModalTitle'
    ).textContent =
      'Edit Master Warehouse';


    $(
      'warehouseId'
    ).value =
      x.id;


    $(
      'warehouseTanggal'
    ).value =
      x.tanggal;


    $(
      'warehouseSPPJ'
    ).value =
      x.sppj;


    $(
      'warehouseMerek'
    ).value =
      x.merek;


    $(
      'warehouseMotif'
    ).value =
      x.motif;


    $(
      'warehouseKodeProduksi'
    ).value =
      x.kodeProduksi;


    $(
      'warehouseSeri'
    ).value =
      x.seri;


    $(
      'warehouseUkuran'
    ).value =
      x.ukuran;


    $(
      'warehouseShift'
    ).value =
      x.shift;


    $(
      'warehouseStatus'
    ).value =
      x.status;


    $(
      'warehouseTanggalInput'
    ).value =
      x.tanggalInput;


    $(
      's1Palet'
    ).value =
      x.kualitas.s1.palet;


    $(
      's1Rimpilan'
    ).value =
      x.kualitas.s1.rimpilan;


    $(
      's2Palet'
    ).value =
      x.kualitas.s2.palet;


    $(
      's2Rimpilan'
    ).value =
      x.kualitas.s2.rimpilan;


    $(
      'kw3Palet'
    ).value =
      x.kualitas.kw3.palet;


    $(
      'kw3Rimpilan'
    ).value =
      x.kualitas.kw3.rimpilan;

  }


  updateWarehouseCalc();


  openModal(
    'warehouseModal'
  );

}


function updateWarehouseCalc() {

  const size =
    normSize(
      $(
        'warehouseUkuran'
      ).value
    );


  const capacity =
    CAPACITY[size] ||
    0;


  const configs = [

    [
      's1Palet',
      's1Rimpilan',
      's1Total',
      's1BoxPerPalet'
    ],

    [
      's2Palet',
      's2Rimpilan',
      's2Total',
      's2BoxPerPalet'
    ],

    [
      'kw3Palet',
      'kw3Rimpilan',
      'kw3Total',
      'kw3BoxPerPalet'
    ]

  ];


  let grand =
    0;


  configs.forEach(
    (
      [
        p,
        r,
        t,
        c
      ]
    ) => {

      const total =
        quality(
          toNum(
            $(
              p
            ).value
          ),
          toNum(
            $(
              r
            ).value
          ),
          capacity
        );


      $(
        c
      ).textContent =
        fmt(
          capacity
        );


      $(
        t
      ).textContent =
        fmt(
          total
        );


      grand +=
        total;

    }
  );


  $(
    'warehouseGrandTotal'
  ).textContent =
    fmt(
      grand
    );

}


function quality(
  palet,
  rimpilan,
  capacity
) {

  return (

    toNum(
      palet
    ) *

    toNum(
      capacity
    )

  ) +

  toNum(
    rimpilan
  );

}


[
  'warehouseUkuran',

  's1Palet',

  's1Rimpilan',

  's2Palet',

  's2Rimpilan',

  'kw3Palet',

  'kw3Rimpilan'

]
.forEach(
  id => {

    $(
      id
    )
    .addEventListener(
      'input',
      updateWarehouseCalc
    );

  }
);


$(
  'warehouseUkuran'
)
.addEventListener(
  'change',
  updateWarehouseCalc
);


$(
  'warehouseForm'
)
.addEventListener(
  'submit',
  e => {

    e.preventDefault();


    const editId =
      $(
        'warehouseId'
      ).value;


    const size =
      normSize(
        $(
          'warehouseUkuran'
        ).value
      );


    const cap =
      CAPACITY[
        size
      ] || 0;


    const kualitas = {

      s1: {

        palet:
          toNum(
            $(
              's1Palet'
            ).value
          ),

        rimpilan:
          toNum(
            $(
              's1Rimpilan'
            ).value
          ),

        total:
          quality(
            $(
              's1Palet'
            ).value,

            $(
              's1Rimpilan'
            ).value,

            cap
          )

      },


      s2: {

        palet:
          toNum(
            $(
              's2Palet'
            ).value
          ),

        rimpilan:
          toNum(
            $(
              's2Rimpilan'
            ).value
          ),

        total:
          quality(
            $(
              's2Palet'
            ).value,

            $(
              's2Rimpilan'
            ).value,

            cap
          )

      },


      kw3: {

        palet:
          toNum(
            $(
              'kw3Palet'
            ).value
          ),

        rimpilan:
          toNum(
            $(
              'kw3Rimpilan'
            ).value
          ),

        total:
          quality(
            $(
              'kw3Palet'
            ).value,

            $(
              'kw3Rimpilan'
            ).value,

            cap
          )

      }

    };


    const x = {

      id:
        editId ||
        makeId(
          'w'
        ),

      tanggal:
        $(
          'warehouseTanggal'
        ).value,

      sppj:
        $(
          'warehouseSPPJ'
        ).value
        .trim(),

      merek:
        $(
          'warehouseMerek'
        ).value
        .trim(),

      motif:
        $(
          'warehouseMotif'
        ).value
        .trim(),

      kodeProduksi:
        $(
          'warehouseKodeProduksi'
        ).value
        .trim(),

      seri:
        $(
          'warehouseSeri'
        ).value
        .trim(),

      ukuran:
        size,

      shift:
        $(
          'warehouseShift'
        ).value,

      status:
        $(
          'warehouseStatus'
        ).value,

      tanggalInput:
        $(
          'warehouseTanggalInput'
        ).value,

      kualitas,

      total:
        kualitas.s1.total +

        kualitas.s2.total +

        kualitas.kw3.total

    };


    if (

      !x.tanggal ||

      !x.sppj ||

      !x.merek ||

      !x.motif ||

      !x.kodeProduksi ||

      !x.seri ||

      !x.ukuran ||

      !x.shift ||

      !x.tanggalInput

    ) {

      alert(
        'Data master belum lengkap.'
      );

      return;

    }


    if (
      x.total <=
      0
    ) {

      alert(
        'Isi minimal salah satu kualitas S1, S2, atau KW3.'
      );

      return;

    }


    const duplicate =
      warehouse.some(
        w =>

          String(
            w.id
          ) !==
          String(
            x.id
          )

          &&

          w.tanggal ===
          x.tanggal

          &&

          normText(
            w.merek
          ) ===
          normText(
            x.merek
          )

          &&

          normText(
            w.motif
          ) ===
          normText(
            x.motif
          )

          &&

          normText(
            w.kodeProduksi
          ) ===
          normText(
            x.kodeProduksi
          )

          &&

          normText(
            w.seri
          ) ===
          normText(
            x.seri
          )

          &&

          normSize(
            w.ukuran
          ) ===
          size

          &&

          normText(
            w.shift
          ) ===
          normText(
            x.shift
          )

      );


    if (
      duplicate
    ) {

      alert(
        'Master yang sama pada shift tersebut sudah ada.'
      );

      return;

    }


    const index =
      warehouse.findIndex(
        w =>
          String(
            w.id
          ) ===
          String(
            x.id
          )
      );


    if (
      index >=
      0
    ) {

      warehouse[index] =
        x;

    }

    else {

      warehouse.push(
        x
      );

    }


    saveAll();


    closeModal(
      'warehouseModal'
    );


    renderWarehouse();

    renderPacking();

    renderDashboard();


    alert(

      index >=
      0

        ?

      'Master Warehouse berhasil diperbarui.'

        :

      'Master Warehouse berhasil ditambahkan.'

    );

  }
);


$(
  'warehouseSearch'
)
.addEventListener(
  'input',
  renderWarehouseTable
);


$(
  'addWarehouseBtn'
)
.addEventListener(
  'click',
  () =>
    openWarehouseModal()
);


document.addEventListener(
  'click',
  e => {

    const edit =
      e.target.closest(
        '[data-edit-w]'
      );


    const del =
      e.target.closest(
        '[data-del-w]'
      );


    if (
      edit
    ) {

      openWarehouseModal(
        edit.dataset.editW
      );

    }


    if (
      del
    ) {

      deleteWarehouse(
        del.dataset.delW
      );

    }

  }
);


function deleteWarehouse(
  id
) {

  const related =
    packing.filter(
      p =>
        String(
          p.masterId
        ) ===
        String(
          id
        )
    ).length;


  const prompt =

    related

      ?

    `Hapus master ini?\n\n${related} data Packing terkait akan ikut terhapus.`

      :

    'Hapus master ini?';


  if (
    !confirm(
      prompt
    )
  ) {

    return;

  }


  warehouse =
    warehouse.filter(
      x =>
        String(
          x.id
        ) !==
        String(
          id
        )
    );


  packing =
    packing.filter(
      x =>
        String(
          x.masterId
        ) !==
        String(
          id
        )
    );


  cleanOrphanPacking();


  saveAll();


  renderWarehouse();

  renderPacking();

  renderDashboard();

}


/* =========================================================
   PACKING / QC
========================================================= */

function packingWithMaster() {

  return packing

    .map(
      p => ({

        p,

        master:
          warehouse.find(
            w =>
              String(
                w.id
              ) ===
              String(
                p.masterId
              )
          )

      })
    )

    .filter(
      x =>
        x.master
    );

}


function packingSort(
  rows
) {

  return rows.sort(
    (
      a,
      b
    ) =>

      sizeIndex(
        a.master.ukuran
      ) -
      sizeIndex(
        b.master.ukuran
      )

      ||

      normText(
        a.master.merek
      ).localeCompare(
        normText(
          b.master.merek
        )
      )

      ||

      normText(
        a.master.kodeProduksi
      ).localeCompare(
        normText(
          b.master.kodeProduksi
        )
      )

      ||

      normText(
        a.master.motif
      ).localeCompare(
        normText(
          b.master.motif
        )
      )

      ||

      normText(
        a.master.seri
      ).localeCompare(
        normText(
          b.master.seri
        )
      )

  );

}


function renderPackingStats() {

  const rows =
    packingWithMaster();


  const total =
    rows.reduce(
      (
        sum,
        x
      ) =>
        sum +
        toNum(
          x.master.total
        ),
      0
    );


  const ok =
    rows.filter(
      x =>
        normText(
          x.p.keterangan
        ) ===
        'OK'
    ).length;


  const rework =
    rows.filter(
      x =>
        normText(
          x.p.keterangan
        ) ===
        'REWORK'
    ).length;


  $(
    'packingCount'
  ).textContent =
    fmt(
      rows.length
    );


  $(
    'packingTotal'
  ).textContent =
    fmt(
      total
    );


  $(
    'packingOK'
  ).textContent =
    fmt(
      ok
    );


  $(
    'packingRework'
  ).textContent =
    fmt(
      rework
    );

}


function renderPackingTable() {

  const q =
    normText(
      $(
        'packingSearch'
      ).value
    );


  const rows =

    packingWithMaster()

      .filter(
        x =>
          [

            x.p.tanggalProduksi,

            x.master.merek,

            x.master.motif,

            x.master.kodeProduksi,

            x.master.seri,

            x.master.ukuran,

            x.master.shift,

            x.p.keterangan

          ]
          .join(
            ' '
          )
          .toUpperCase()
          .includes(
            q
          )
      );


  packingSort(
    rows
  );


  if (
    !rows.length
  ) {

    $(
      'packingTableBody'
    ).innerHTML =

      `
        <tr>
          <td
            colspan="15"
            class="empty-state"
          >
            Belum ada data Packing.
          </td>
        </tr>
      `;

    return;

  }


  let html =
    '';

  let last =
    null;

  let no =
    0;


  rows.forEach(
    (
      {
        p,
        master
      }
    ) => {

      const size =
        normSize(
          master.ukuran
        );


      if (
        size !==
        last
      ) {

        html +=
          groupHeader(
            size
          );


        last =
          size;

      }


      no++;


      const status =
        normText(
          p.keterangan
        );


      const badge =

        status ===
        'OK'

          ?

        'badge-success'

          :

        status ===
        'REWORK'

          ?

        'badge-warning'

          :

        'badge-danger';


      html += `

        <tr>

          <td>
            ${no}
          </td>

          <td>
            ${esc(
              p.tanggalProduksi
            )}
          </td>

          <td>
            <b>
              ${esc(
                master.merek
              )}
            </b>
          </td>

          <td>
            ${esc(
              master.motif
            )}
          </td>

          <td>
            ${esc(
              master.kodeProduksi
            )}
          </td>

          <td>
            ${esc(
              master.seri
            )}
          </td>

          <td>
            ${sizeBadge(
              master.ukuran
            )}
          </td>

          <td>
            ${fmt(
              master.kualitas.s1.total
            )}
          </td>

          <td>
            ${fmt(
              master.kualitas.s2.total
            )}
          </td>

          <td>
            ${fmt(
              master.kualitas.kw3.total
            )}
          </td>

          <td>
            <b>
              ${fmt(
                master.total
              )}
            </b>
          </td>

          <td>

            <span
              class="badge ${badge}"
            >
              ${esc(
                p.keterangan
              )}
            </span>

          </td>

          <td>
            ${esc(
              p.tanggalInput
            )}
          </td>

          <td>
            ${esc(
              p.shift
            )}
          </td>

          <td>

            <div
              class="action-group"
            >

              <button
                class="action-btn edit"
                data-edit-p="${esc(
                  p.id
                )}"
              >
                Edit
              </button>

              <button
                class="action-btn delete"
                data-del-p="${esc(
                  p.id
                )}"
              >
                Hapus
              </button>

            </div>

          </td>

        </tr>

      `;

    }
  );


  $(
    'packingTableBody'
  ).innerHTML =
    html;

}


function populatePackingMaster(
  selectedId = ''
) {

  const select =
    $(
      'packingMasterId'
    );


  select.innerHTML =
    '<option value="">Pilih Master Warehouse</option>';


  [
    ...warehouse
  ]
  .sort(
    (
      a,
      b
    ) =>

      sizeIndex(
        a.ukuran
      ) -
      sizeIndex(
        b.ukuran
      )

      ||

      normText(
        a.merek
      ).localeCompare(
        normText(
          b.merek
        )
      )

      ||

      normText(
        a.kodeProduksi
      ).localeCompare(
        normText(
          b.kodeProduksi
        )
      )
  )
  .forEach(
    w => {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        w.id;


      option.textContent =

        `${sizeLabel(w.ukuran)} | ${w.merek} | ${w.kodeProduksi} | ${w.motif} | Seri ${w.seri} | ${w.shift} | ${fmt(w.total)} Box`;


      select.appendChild(
        option
      );

    }
  );


  if (
    selectedId
  ) {

    select.value =
      selectedId;

  }

}


function showPackingMaster() {

  const w =
    warehouse.find(
      x =>
        String(
          x.id
        ) ===
        String(
          $(
            'packingMasterId'
          ).value
        )
    );


  $(
    'packingMerek'
  ).value =
    w?.merek ||
    '';


  $(
    'packingMotif'
  ).value =
    w?.motif ||
    '';


  $(
    'packingKodeProduksi'
  ).value =
    w?.kodeProduksi ||
    '';


  $(
    'packingSeri'
  ).value =
    w?.seri ||
    '';


  $(
    'packingUkuran'
  ).value =

    w
      ?

    sizeLabel(
      w.ukuran
    )

      :

    '';


  $(
    'packingS1'
  ).textContent =

    fmt(
      w?.kualitas.s1.total
    );


  $(
    'packingS2'
  ).textContent =

    fmt(
      w?.kualitas.s2.total
    );


  $(
    'packingKW3'
  ).textContent =

    fmt(
      w?.kualitas.kw3.total
    );


  $(
    'packingJumlah'
  ).textContent =

    fmt(
      w?.total
    );

}


function openPackingModal(
  editId = ''
) {

  $(
    'packingForm'
  ).reset();


  $(
    'packingId'
  ).value =
    '';


  $(
    'packingTanggalProduksi'
  ).value =
    today();


  $(
    'packingTanggalInput'
  ).value =
    today();


  $(
    'packingModalTitle'
  ).textContent =
    'Tambah Packing / QC';


  populatePackingMaster();


  if (
    editId
  ) {

    const p =
      packing.find(
        x =>
          String(
            x.id
          ) ===
          String(
            editId
          )
      );


    if (
      !p
    ) {

      return;

    }


    $(
      'packingModalTitle'
    ).textContent =
      'Edit Packing / QC';


    $(
      'packingId'
    ).value =
      p.id;


    populatePackingMaster(
      p.masterId
    );


    $(
      'packingTanggalProduksi'
    ).value =
      p.tanggalProduksi;


    $(
      'packingKeterangan'
    ).value =
      p.keterangan;


    $(
      'packingTanggalInput'
    ).value =
      p.tanggalInput;


    $(
      'packingShift'
    ).value =
      p.shift;


    showPackingMaster();

  }


  openModal(
    'packingModal'
  );

}


$(
  'packingMasterId'
)
.addEventListener(
  'change',
  showPackingMaster
);


$(
  'addPackingBtn'
)
.addEventListener(
  'click',
  () =>
    openPackingModal()
);


$(
  'packingSearch'
)
.addEventListener(
  'input',
  renderPackingTable
);


$(
  'packingForm'
)
.addEventListener(
  'submit',
  e => {

    e.preventDefault();


    const editId =
      $(
        'packingId'
      ).value;


    const master =
      warehouse.find(
        x =>
          String(
            x.id
          ) ===
          String(
            $(
              'packingMasterId'
            ).value
          )
      );


    if (
      !master
    ) {

      alert(
        'Pilih Master Warehouse.'
      );

      return;

    }


    const p = {

      id:
        editId ||
        makeId(
          'p'
        ),

      masterId:
        master.id,

      tanggalProduksi:
        $(
          'packingTanggalProduksi'
        ).value,

      keterangan:
        $(
          'packingKeterangan'
        ).value,

      tanggalInput:
        $(
          'packingTanggalInput'
        ).value,

      shift:
        $(
          'packingShift'
        ).value

    };


    if (

      !p.tanggalProduksi ||

      !p.tanggalInput ||

      !p.shift

    ) {

      alert(
        'Data Packing belum lengkap.'
      );

      return;

    }


    const idx =
      packing.findIndex(
        x =>
          String(
            x.id
          ) ===
          String(
            editId
          )
      );


    if (
      idx >=
      0
    ) {

      packing[idx] =
        p;

    }

    else {

      packing.push(
        p
      );

    }


    saveAll();


    closeModal(
      'packingModal'
    );


    renderPacking();

    renderDashboard();


    alert(

      idx >=
      0

        ?

      'Packing berhasil diperbarui.'

        :

      'Packing berhasil disimpan.'

    );

  }
);


document.addEventListener(
  'click',
  e => {

    const edit =
      e.target.closest(
        '[data-edit-p]'
      );


    const del =
      e.target.closest(
        '[data-del-p]'
      );


    if (
      edit
    ) {

      openPackingModal(
        edit.dataset.editP
      );

    }


    if (
      del
    ) {

      deletePacking(
        del.dataset.delP
      );

    }

  }
);


function renderPacking() {

  cleanOrphanPacking();

  renderPackingStats();

  renderPackingTable();

  populatePackingMaster(
    $(
      'packingMasterId'
    ).value
  );

}


function deletePacking(
  id
) {

  if (
    !confirm(
      'Hapus data Packing ini?'
    )
  ) {

    return;

  }


  packing =
    packing.filter(
      x =>
        String(
          x.id
        ) !==
        String(
          id
        )
    );


  saveAll();


  renderPacking();

  renderDashboard();

}


/* =========================================================
   ADMIN
========================================================= */

function adminKey(
  row
) {

  return [

    row.tanggal,

    normText(
      row.merek
    ),

    normText(
      row.kodeProduksi
    ),

    normText(
      row.motif
    ),

    normText(
      row.seri
    ),

    normSize(
      row.ukuran
    )

  ].join(
    '|'
  );

}


function buildAdmin(
  date
) {

  const map =
    new Map();


  warehouse
    .filter(
      x =>
        x.tanggal ===
        date
    )
    .forEach(
      w => {

        const key =
          adminKey(
            w
          );


        if (
          !map.has(
            key
          )
        ) {

          map.set(
            key,
            {

              id:
                makeId(
                  'a'
                ),

              tanggal:
                w.tanggal,

              kodeProduksi:
                w.kodeProduksi,

              motif:
                w.motif,

              merek:
                w.merek,

              seri:
                w.seri,

              ukuran:
                normSize(
                  w.ukuran
                ),

              s1:
                0,

              s2:
                0,

              kw3:
                0,

              total:
                0

            }
          );

        }


        const g =
          map.get(
            key
          );


        g.s1 +=
          toNum(
            w.kualitas.s1.total
          );


        g.s2 +=
          toNum(
            w.kualitas.s2.total
          );


        g.kw3 +=
          toNum(
            w.kualitas.kw3.total
          );


        g.total =

          g.s1 +

          g.s2 +

          g.kw3;

      }
    );


  return [
    ...map.values()
  ];

}


function adminSort(
  rows
) {

  return rows.sort(
    (
      a,
      b
    ) =>

      sizeIndex(
        a.ukuran
      ) -
      sizeIndex(
        b.ukuran
      )

      ||

      normText(
        a.merek
      ).localeCompare(
        normText(
          b.merek
        )
      )

      ||

      normText(
        a.kodeProduksi
      ).localeCompare(
        normText(
          b.kodeProduksi
        )
      )

      ||

      normText(
        a.motif
      ).localeCompare(
        normText(
          b.motif
        )
      )

      ||

      normText(
        a.seri
      ).localeCompare(
        normText(
          b.seri
        )
      )

  );

}


function renderAdminStats() {

  const date =
    $(
      'adminTanggal'
    ).value;


  const rows =
    admin.filter(
      x =>
        !date ||
        x.tanggal ===
        date
    );


  const s1 =
    rows.reduce(
      (
        a,
        x
      ) =>
        a +
        toNum(
          x.s1
        ),
      0
    );


  const s2 =
    rows.reduce(
      (
        a,
        x
      ) =>
        a +
        toNum(
          x.s2
        ),
      0
    );


  const kw3 =
    rows.reduce(
      (
        a,
        x
      ) =>
        a +
        toNum(
          x.kw3
        ),
      0
    );


  $(
    'adminGroupCount'
  ).textContent =
    fmt(
      rows.length
    );


  $(
    'adminS1'
  ).textContent =
    fmt(
      s1
    );


  $(
    'adminS2'
  ).textContent =
    fmt(
      s2
    );


  $(
    'adminKW3'
  ).textContent =
    fmt(
      kw3
    );


  $(
    'adminTotal'
  ).textContent =
    fmt(
      s1 +
      s2 +
      kw3
    );

}


function renderAdminTable() {

  const date =
    $(
      'adminTanggal'
    ).value;


  const q =
    normText(
      $(
        'adminSearch'
      ).value
    );


  const rows =

    admin.filter(
      x =>

        (
          !date ||
          x.tanggal ===
          date
        )

        &&

        [

          x.tanggal,

          x.kodeProduksi,

          x.motif,

          x.merek,

          x.seri,

          x.ukuran,

          x.s1,

          x.s2,

          x.kw3,

          x.total

        ]
        .join(
          ' '
        )
        .toUpperCase()
        .includes(
          q
        )

    );


  adminSort(
    rows
  );


  if (
    !rows.length
  ) {

    $(
      'adminTableBody'
    ).innerHTML =

      `
        <tr>
          <td
            colspan="12"
            class="empty-state"
          >
            Belum ada laporan Admin.
          </td>
        </tr>
      `;

    return;

  }


  let html =
    '';

  let last =
    null;

  let no =
    0;


  rows.forEach(
    x => {

      const size =
        normSize(
          x.ukuran
        );


      if (
        size !==
        last
      ) {

        html +=
          groupHeader(
            size
          );


        last =
          size;

      }


      no++;


      html += `

        <tr>

          <td>
            ${no}
          </td>

          <td>
            ${esc(
              x.tanggal
            )}
          </td>

          <td>
            <b>
              ${esc(
                x.kodeProduksi
              )}
            </b>
          </td>

          <td>
            ${esc(
              x.motif
            )}
          </td>

          <td>
            <b>
              ${esc(
                x.merek
              )}
            </b>
          </td>

          <td>
            ${esc(
              x.seri
            )}
          </td>

          <td>
            ${sizeBadge(
              x.ukuran
            )}
          </td>

          <td>
            ${fmt(
              x.s1
            )}
          </td>

          <td>
            ${fmt(
              x.s2
            )}
          </td>

          <td>
            ${fmt(
              x.kw3
            )}
          </td>

          <td>
            <b>
              ${fmt(
                x.total
              )}
            </b>
          </td>

          <td>

            <div
              class="action-group"
            >

              <button
                class="action-btn edit"
                data-edit-a="${esc(
                  x.id
                )}"
              >
                Edit
              </button>

              <button
                class="action-btn delete"
                data-del-a="${esc(
                  x.id
                )}"
              >
                Hapus
              </button>

            </div>

          </td>

        </tr>

      `;

    }
  );


  $(
    'adminTableBody'
  ).innerHTML =
    html;

}


function renderAdmin() {

  renderAdminStats();

  renderAdminTable();

}


$(
  'adminTanggal'
)
.value =
today();


$(
  'adminTanggal'
)
.addEventListener(
  'change',
  renderAdmin
);


$(
  'adminSearch'
)
.addEventListener(
  'input',
  renderAdminTable
);


$(
  'generateAdminBtn'
)
.addEventListener(
  'click',
  () => {

    const date =
      $(
        'adminTanggal'
      ).value;


    if (
      !date
    ) {

      alert(
        'Pilih tanggal laporan.'
      );

      return;

    }


    if (
      !warehouse.some(
        w =>
          w.tanggal ===
          date
      )
    ) {

      alert(
        'Tidak ada data Warehouse pada tanggal tersebut.'
      );

      return;

    }


    if (
      !confirm(
        'Generate ulang laporan tanggal ini?\n\nSemua shift akan digabung berdasarkan master yang sama.'
      )
    ) {

      return;

    }


    admin =
      admin.filter(
        x =>
          x.tanggal !==
          date
      );


    admin.push(
      ...buildAdmin(
        date
      )
    );


    saveAll();


    renderAdmin();

    renderDashboard();

  }
);


function openAdminModal(
  editId
) {

  const x =
    admin.find(
      a =>
        String(
          a.id
        ) ===
        String(
          editId
        )
    );


  if (
    !x
  ) {

    return;

  }


  $(
    'adminId'
  ).value =
    x.id;


  $(
    'adminEditTanggal'
  ).value =
    x.tanggal;


  $(
    'adminEditKode'
  ).value =
    x.kodeProduksi;


  $(
    'adminEditMotif'
  ).value =
    x.motif;


  $(
    'adminEditMerek'
  ).value =
    x.merek;


  $(
    'adminEditSeri'
  ).value =
    x.seri;


  $(
    'adminEditUkuran'
  ).value =
    x.ukuran;


  $(
    'adminEditS1'
  ).value =
    x.s1;


  $(
    'adminEditS2'
  ).value =
    x.s2;


  $(
    'adminEditKW3'
  ).value =
    x.kw3;


  updateAdminEditTotal();


  openModal(
    'adminModal'
  );

}


document.addEventListener(
  'click',
  e => {

    const edit =
      e.target.closest(
        '[data-edit-a]'
      );


    const del =
      e.target.closest(
        '[data-del-a]'
      );


    if (
      edit
    ) {

      openAdminModal(
        edit.dataset.editA
      );

    }


    if (
      del
    ) {

      deleteAdmin(
        del.dataset.delA
      );

    }

  }
);


function updateAdminEditTotal() {

  const total =

    toNum(
      $(
        'adminEditS1'
      ).value
    )

    +

    toNum(
      $(
        'adminEditS2'
      ).value
    )

    +

    toNum(
      $(
        'adminEditKW3'
      ).value
    );


  $(
    'adminEditTotal'
  ).textContent =
    fmt(
      total
    );

}


[
  'adminEditS1',

  'adminEditS2',

  'adminEditKW3'

]
.forEach(
  i => {

    $(
      i
    )
    .addEventListener(
      'input',
      updateAdminEditTotal
    );

  }
);


$(
  'adminForm'
)
.addEventListener(
  'submit',
  e => {

    e.preventDefault();


    const id =
      $(
        'adminId'
      ).value;


    const index =
      admin.findIndex(
        x =>
          String(
            x.id
          ) ===
          String(
            id
          )
      );


    if (
      index <
      0
    ) {

      return;

    }


    const s1 =
      toNum(
        $(
          'adminEditS1'
        ).value
      );


    const s2 =
      toNum(
        $(
          'adminEditS2'
        ).value
      );


    const kw3 =
      toNum(
        $(
          'adminEditKW3'
        ).value
      );


    admin[index] = {

      id,

      tanggal:
        $(
          'adminEditTanggal'
        ).value,

      kodeProduksi:
        $(
          'adminEditKode'
        ).value
        .trim(),

      motif:
        $(
          'adminEditMotif'
        ).value
        .trim(),

      merek:
        $(
          'adminEditMerek'
        ).value
        .trim(),

      seri:
        $(
          'adminEditSeri'
        ).value
        .trim(),

      ukuran:
        normSize(
          $(
            'adminEditUkuran'
          ).value
        ),

      s1,

      s2,

      kw3,

      total:
        s1 +
        s2 +
        kw3

    };


    saveAll();


    closeModal(
      'adminModal'
    );


    renderAdmin();

    renderDashboard();


    alert(
      'Laporan Admin berhasil diperbarui.'
    );

  }
);


function deleteAdmin(
  id
) {

  if (
    !confirm(
      'Hapus laporan Admin ini?'
    )
  ) {

    return;

  }


  admin =
    admin.filter(
      x =>
        String(
          x.id
        ) !==
        String(
          id
        )
    );


  saveAll();


  renderAdmin();

  renderDashboard();

}


/* =========================================================
   EXCEL EXPORT
========================================================= */

function excelSizeColor(
  size
) {

  return ({

    '25x50': {

      fill:
        'FFF2CC',

      font:
        '7F6000'

    },

    '50x50': {

      fill:
        'FFFFFF',

      font:
        '000000'

    },

    '60x60': {

      fill:
        'D9EAD3',

      font:
        '274E13'

    },

    '60x120': {

      fill:
        'CFE2F3',

      font:
        '073763'

    }

  }[
    normSize(
      size
    )
  ] ||

  {

    fill:
      'F3F4F6',

    font:
      '374151'

  });

}


function borderCell(
  cell
) {

  cell.border = {

    top:
      {
        style:
          'thin'
      },

    bottom:
      {
        style:
          'thin'
      },

    left:
      {
        style:
          'thin'
      },

    right:
      {
        style:
          'thin'
      }

  };

}


function excelCard(
  ws,
  row,
  col,
  item
) {

  const end =
    col +
    5;


  ws.mergeCells(
    row,
    col,
    row,
    end
  );


  const h =
    ws.getCell(
      row,
      col
    );


  h.value =
    `${item.merek} - ${item.kodeProduksi}`;


  h.font = {

    name:
      'Arial',

    size:
      11,

    bold:
      true,

    color:
      {
        argb:
          'FFFFFFFF'
      }

  };


  h.alignment = {

    horizontal:
      'center'

  };


  h.fill = {

    type:
      'pattern',

    pattern:
      'solid',

    fgColor:
      {
        argb:
          '087555'
      }

  };


  const info = [

    [
      'Tanggal',
      item.tanggal,
      'Seri',
      item.seri
    ],

    [
      'Merek',
      item.merek,
      'Ukuran',
      sizeLabel(
        item.ukuran
      )
    ],

    [
      'Motif',
      item.motif,
      'Kode',
      item.kodeProduksi
    ]

  ];


  info.forEach(
    (
      v,
      i
    ) => {

      const r =
        ws.getRow(
          row +
          1 +
          i
        );


      r.getCell(
        col
      ).value =
        v[0];


      r.getCell(
        col +
        1
      ).value =
        v[1];


      r.getCell(
        col +
        3
      ).value =
        v[2];


      r.getCell(
        col +
        4
      ).value =
        v[3];


      for (
        let c =
          col;

        c <=
          end;

        c++
      ) {

        borderCell(
          r.getCell(
            c
          )
        );

      }


      r.getCell(
        col
      ).font = {

        bold:
          true

      };


      r.getCell(
        col +
        3
      ).font = {

        bold:
          true

      };

    }
  );


  const color =
    excelSizeColor(
      item.ukuran
    );


  ws.getCell(
    row +
    2,
    col +
    4
  ).fill = {

    type:
      'pattern',

    pattern:
      'solid',

    fgColor:
      {

        argb:
          color.fill

      }

  };


  ws.getCell(
    row +
    2,
    col +
    4
  ).font = {

    bold:
      true,

    color:
      {

        argb:
          color.font

      }

  };


  const q =
    row +
    4;


  [
    'Kualitas',

    'Palet',

    'Rimpilan',

    'Total'

  ]
  .forEach(
    (
      v,
      i
    ) => {

      const c =
        ws.getCell(
          q,
          col +
          i
        );


      c.value =
        v;


      c.font = {

        bold:
          true,

        color:
          {

            argb:
              'FFFFFFFF'

          }

      };


      c.alignment = {

        horizontal:
          'center'

      };


      c.fill = {

        type:
          'pattern',

        pattern:
          'solid',

        fgColor:
          {

            argb:
              '5D8075'

          }

      };


      borderCell(
        c
      );

    }
  );


  [

    [
      'S1',
      item.s1,
      'E2F0D9'
    ],

    [
      'S2',
      item.s2,
      'FFF2CC'
    ],

    [
      'KW3',
      item.kw3,
      'FCE4D6'
    ]

  ]
  .forEach(
    (
      v,
      i
    ) => {

      const r =
        ws.getRow(
          q +
          1 +
          i
        );


      r.getCell(
        col
      ).value =
        v[0];


      r.getCell(
        col +
        1
      ).value =
        '-';


      r.getCell(
        col +
        2
      ).value =
        '-';


      r.getCell(
        col +
        3
      ).value =
        toNum(
          v[1]
        );


      for (
        let c =
          col;

        c <=
          col +
          3;

        c++
      ) {

        borderCell(
          r.getCell(
            c
          )
        );

      }


      r.getCell(
        col
      ).fill = {

        type:
          'pattern',

        pattern:
          'solid',

        fgColor:
          {

            argb:
              v[2]

          }

      };


      r.getCell(
        col +
        3
      ).numFmt =
        '#,##0';

    }
  );


  ws.mergeCells(
    q +
    4,
    col,
    q +
    4,
    col +
    2
  );


  const tr =
    ws.getCell(
      q +
      4,
      col
    );


  tr.value =
    'TOTAL';


  tr.font = {

    bold:
      true

  };


  tr.fill = {

    type:
      'pattern',

    pattern:
      'solid',

    fgColor:
      {

        argb:
          'DDE9E4'

      }

  };


  const totalCell =
    ws.getCell(
      q +
      4,
      col +
      3
    );


  totalCell.value =
    toNum(
      item.total
    );


  totalCell.numFmt =
    '#,##0';


  totalCell.font = {

    bold:
      true

  };


  totalCell.fill = {

    type:
      'pattern',

    pattern:
      'solid',

    fgColor:
      {

        argb:
          'DDE9E4'

      }

  };


  for (
    let c =
      col;

    c <=
      col +
      3;

    c++
  ) {

    borderCell(
      ws.getCell(
        q +
        4,
        c
      )
    );

  }

}


async function exportAdminExcel() {

  if (
    typeof ExcelJS ===
    'undefined'
  ) {

    alert(
      'ExcelJS belum termuat. Pastikan internet aktif.'
    );

    return;

  }


  const date =
    $(
      'adminTanggal'
    ).value;


  if (
    !date
  ) {

    alert(
      'Pilih tanggal laporan.'
    );

    return;

  }


  const rows =
    admin.filter(
      x =>
        x.tanggal ===
        date
    );


  if (
    !rows.length
  ) {

    alert(
      'Belum ada laporan Admin pada tanggal tersebut.'
    );

    return;

  }


  adminSort(
    rows
  );


  const wb =
    new ExcelJS.Workbook();


  wb.creator =
    'FG Report System';


  const ws =
    wb.addWorksheet(
      'Laporan Harian'
    );


  ws.pageSetup = {

    orientation:
      'landscape',

    paperSize:
      9,

    fitToPage:
      true,

    fitToWidth:
      1,

    fitToHeight:
      0

  };


  ws.columns =
    Array
      .from(
        {
          length:
            14
        },
        (
          _,
          i
        ) => ({

          width:
            [

              4,

              12,

              16,

              24,

              14,

              9,

              12,

              4,

              12,

              16,

              24,

              14,

              9,

              12

            ][i]

        })
      );


  ws.mergeCells(
    'A1:N1'
  );


  const title =
    ws.getCell(
      'A1'
    );


  title.value =
    'LAPORAN HARIAN FINISH GOODS';


  title.font = {

    name:
      'Arial',

    size:
      16,

    bold:
      true,

    color:
      {
        argb:
          'FFFFFFFF'
      }

  };


  title.alignment = {

    horizontal:
      'center'

  };


  title.fill = {

    type:
      'pattern',

    pattern:
      'solid',

    fgColor:
      {
        argb:
          '0F4F3D'
      }

  };


  ws.mergeCells(
    'A2:N2'
  );


  ws.getCell(
    'A2'
  ).value =
    `Tanggal: ${date}`;


  ws.getCell(
    'A2'
  ).alignment = {

    horizontal:
      'center'

  };


  const groups =
    new Map();


  rows.forEach(
    x => {

      const s =
        normSize(
          x.ukuran
        );


      if (
        !groups.has(
          s
        )
      ) {

        groups.set(
          s,
          []
        );

      }


      groups
        .get(
          s
        )
        .push(
          x
        );

    }
  );


  let r =
    4;


  SIZE_ORDER.forEach(
    size => {

      if (
        !groups.has(
          size
        )
      ) {

        return;

      }


      ws.mergeCells(
        r,
        1,
        r,
        14
      );


      const hc =
        ws.getCell(
          r,
          1
        );


      const sc =
        excelSizeColor(
          size
        );


      hc.value =
        `UKURAN ${sizeLabel(size)} | ${fmt(CAPACITY[size])} BOX / PALET`;


      hc.fill = {

        type:
          'pattern',

        pattern:
          'solid',

        fgColor:
          {
            argb:
              sc.fill
          }

      };


      hc.font = {

        name:
          'Arial',

        size:
          11,

        bold:
          true,

        color:
          {
            argb:
              sc.font
          }

      };


      r +=
        2;


      const group =
        groups.get(
          size
        );


      for (
        let i =
          0;

        i <
          group.length;

        i +=
          2
      ) {

        excelCard(
          ws,
          r,
          1,
          group[i]
        );


        if (
          group[i + 1]
        ) {

          excelCard(
            ws,
            r,
            8,
            group[i + 1]
          );

        }


        r +=
          10;

      }


      r +=
        2;

    }
  );


  const s1 =
    rows.reduce(
      (
        a,
        x
      ) =>
        a +
        toNum(
          x.s1
        ),
      0
    );


  const s2 =
    rows.reduce(
      (
        a,
        x
      ) =>
        a +
        toNum(
          x.s2
        ),
      0
    );


  const kw3 =
    rows.reduce(
      (
        a,
        x
      ) =>
        a +
        toNum(
          x.kw3
        ),
      0
    );


  const grand =
    s1 +
    s2 +
    kw3;


  ws.mergeCells(
    r,
    1,
    r,
    7
  );


  ws.mergeCells(
    r,
    8,
    r,
    14
  );


  ws.getCell(
    r,
    1
  ).value =

    `S1: ${fmt(s1)} | S2: ${fmt(s2)} | KW3: ${fmt(kw3)}`;


  ws.getCell(
    r,
    8
  ).value =

    `GRAND TOTAL: ${fmt(grand)} BOX`;


  for (
    let c =
      1;

    c <=
      14;

    c++
  ) {

    const cell =
      ws.getCell(
        r,
        c
      );


    cell.fill = {

      type:
        'pattern',

      pattern:
        'solid',

      fgColor:
        {
          argb:
            '0F4F3D'
        }

    };


    cell.font = {

      name:
        'Arial',

      size:
        10,

      bold:
        true,

      color:
        {
          argb:
            'FFFFFFFF'
        }

    };


    cell.alignment = {

      horizontal:
        'center'

    };

  }


  ws.views = [

    {

      state:
        'frozen',

      ySplit:
        3

    }

  ];


  const buffer =
    await wb.xlsx.writeBuffer();


  const blob =
    new Blob(
      [
        buffer
      ],
      {

        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const a =
    document.createElement(
      'a'
    );


  a.href =
    url;


  a.download =
    `Laporan-Finish-Goods-${date}.xlsx`;


  document.body.appendChild(
    a
  );


  a.click();


  a.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    500
  );

}


$(
  'exportAdminBtn'
)
.addEventListener(
  'click',
  exportAdminExcel
);


/* =========================================================
   INIT
========================================================= */

function init() {

  loadAll();


  $(
    'adminTanggal'
  ).value =
    today();


  renderDashboard();

  renderWarehouse();

  renderPacking();

  renderAdmin();

}


init();