/* React owns the SVG; D3 supplies scales and path geometry. No build step needed. */
(() => {
  if (!window.React || !window.ReactDOM || !window.d3) return;
  const h = React.createElement;
  const cities = [
    { name: "Chicago", latitude: 41.8781 },
    { name: "Tromsø", latitude: 69.6492 },
    { name: "London", latitude: 51.5074 },
    { name: "Singapore", latitude: 1.3521 },
    { name: "Sydney", latitude: -33.8688 },
  ];
  const year = 2026;
  const start = Date.UTC(year, 0, 1);
  const days = (Date.UTC(year + 1, 0, 1) - start) / 86400000;
  const radians = Math.PI / 180;

  // NOAA's fractional-year approximation, evaluated at local solar noon.
  function daylightHours(day, latitude) {
    const gamma = 2 * Math.PI * day / days;
    const declination = 0.006918 - 0.399912 * Math.cos(gamma)
      + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma)
      + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma)
      + 0.00148 * Math.sin(3 * gamma);
    const lat = latitude * radians;
    const cosine = Math.cos(90.833 * radians) / (Math.cos(lat) * Math.cos(declination))
      - Math.tan(lat) * Math.tan(declination);
    return 24 * Math.acos(Math.max(-1, Math.min(1, cosine))) / Math.PI;
  }

  const data = cities.map(city => Array.from({ length: days }, (_, day) => ({
    day, hours: daylightHours(day, city.latitude),
  })));
  const formatDate = new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", timeZone: "UTC",
  });
  const duration = hours => {
    const minutes = Math.round(hours * 60);
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  };
  const width = 720, height = 250;
  const x = d3.scaleLinear().domain([0, days - 1]).range([44, width - 16]).clamp(true);
  const y = d3.scaleLinear().domain([0, 24]).range([height - 32, 16]);
  const line = d3.line().x(d => x(d.day)).y(d => y(d.hours));
  const area = d3.area().x(d => x(d.day)).y0(y(0)).y1(d => y(d.hours));
  const nightArea = d3.area().x(d => x(d.day)).y0(d => y(d.hours)).y1(y(24));
  const months = Array.from({ length: 12 }, (_, month) => ({
    day: (Date.UTC(year, month, 15) - start) / 86400000,
    label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, month, 15))),
  }));

  function DaylightChart() {
    const [city, setCity] = React.useState(0);
    const [comparison, setComparison] = React.useState("");
    const [day, setDay] = React.useState(171);
    const dateLabel = formatDate.format(new Date(start + day * 86400000));
    const secondary = comparison === "" ? null : Number(comparison);
    const primaryHours = data[city][day].hours;
    const readout = `${dateLabel}: ${cities[city].name}, ${duration(primaryHours)} of daylight and ${duration(24 - primaryHours)} of darkness`
      + (secondary === null ? "" : `; ${cities[secondary].name}, ${duration(data[secondary][day].hours)}`);

    function selectPointer(event) {
      const bounds = event.currentTarget.getBoundingClientRect();
      setDay(Math.round(x.invert((event.clientX - bounds.left) / bounds.width * width)));
    }

    return h(React.Fragment, null,
      h("div", { className: "daylight-controls" },
        h("label", null, "City", h("select", {
          value: city,
          onChange: event => {
            const next = Number(event.target.value);
            setCity(next);
            if (Number(comparison) === next) setComparison("");
          },
        }, cities.map((item, i) => h("option", { key: item.name, value: i }, item.name)))),
        h("label", null, "Compare with", h("select", {
          value: comparison, onChange: event => setComparison(event.target.value),
        }, h("option", { value: "" }, "None"),
        cities.map((item, i) => i === city ? null : h("option", { key: item.name, value: i }, item.name)))),
        h("span", { className: "daylight-year" }, year),
      ),
      h("div", { className: "daylight-readout" },
        h("span", { className: "daylight-date" }, dateLabel),
        h("span", { className: "daylight-primary" }, `${cities[city].name} · ${duration(primaryHours)} daylight · ${duration(24 - primaryHours)} darkness`),
        secondary === null ? null : h("span", { className: "daylight-comparison" },
          `${cities[secondary].name} · ${duration(data[secondary][day].hours)}`),
      ),
      h("div", { className: "daylight-legend", "aria-label": "Chart colors" },
        h("span", null, h("span", { className: "daylight-swatch", "aria-hidden": true }), "Daylight"),
        h("span", null, h("span", { className: "daylight-swatch daylight-swatch-night", "aria-hidden": true }), "Darkness"),
      ),
      h("svg", {
        className: "daylight-chart", viewBox: `0 0 ${width} ${height}`,
        role: "img", "aria-labelledby": "daylight-chart-title daylight-chart-desc",
        onPointerMove: event => { if (event.pointerType !== "touch" || event.buttons) selectPointer(event); },
        onPointerDown: selectPointer,
      },
      h("title", { id: "daylight-chart-title" }, `Daylight hours in ${cities[city].name}, ${year}`),
      h("desc", { id: "daylight-chart-desc" },
        `Each day totals 24 hours: yellow below the curve represents daylight, gray above represents darkness. ${readout}. Use the date slider below to explore.`),
      h("path", { d: nightArea(data[city]), className: "daylight-night-area" }),
      h("path", { d: area(data[city]), className: "daylight-area" }),
      [0, 6, 12, 18, 24].map(hours => h("g", { key: hours },
        h("line", { x1: 44, x2: width - 16, y1: y(hours), y2: y(hours), className: "daylight-grid" }),
        h("text", { x: 34, y: y(hours) + 4, textAnchor: "end", className: "daylight-axis" }, `${hours}h`))),
      secondary === null ? null : h("path", { d: line(data[secondary]), className: "daylight-line daylight-line-comparison" }),
      h("path", { d: line(data[city]), className: "daylight-line" }),
      months.map(month => h("text", { key: month.label, x: x(month.day), y: height - 8,
        textAnchor: "middle", className: "daylight-axis" }, month.label)),
      h("line", { x1: x(day), x2: x(day), y1: 16, y2: y(0), className: "daylight-guide" }),
      secondary === null ? null : h("circle", { cx: x(day), cy: y(data[secondary][day].hours), r: 4,
        className: "daylight-dot daylight-dot-comparison" }),
      h("circle", { cx: x(day), cy: y(primaryHours), r: 5, className: "daylight-dot" }),
      ),
      h("label", { className: "daylight-slider-label", htmlFor: "daylight-day" }, "Explore a day"),
      h("input", { id: "daylight-day", className: "daylight-slider", type: "range", min: 0, max: days - 1,
        value: day, "aria-valuetext": readout, onChange: event => setDay(Number(event.target.value)) }),
      h("p", { className: "daylight-hint" }, "Hover or tap the chart, or use the slider to explore."),
    );
  }

  ReactDOM.createRoot(document.getElementById("daylight-root")).render(h(DaylightChart));
})();
