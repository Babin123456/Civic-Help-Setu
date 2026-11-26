# Water-Connection Demand & Capacity Planning Visualizer

## Statutory Engineering Standards
This visualizer models anticipated domestic and commercial water consumption based on established national public health engineering standards:
- **Central Public Health and Environmental Engineering Organisation (CPHEEO) Manual on Water Supply and Treatment** (Ministry of Housing and Urban Affairs).
- **National Building Code (NBC) 2016 Part 9 Section 1** (Plumbing Services & Water Supply).

---

## National Per-Capita Consumption Benchmarks

| Category | Statutory Metric | Standard Allowance | Reference |
| :--- | :--- | :--- | :--- |
| **Urban Residential** | Per resident / household member | **135 Litres / day (LPCD)** | CPHEEO Manual Table 2.1 |
| **Commercial Offices** | Per staff / desk occupant | **45 Litres / day** | NBC 2016 Table 1 |
| **Restaurants & Eateries**| Per seated dining patron | **70 Litres / day** | CPHEEO Commercial Norms |

---

## On-Site Storage & Infrastructure Recommendations
To safeguard against intermittent municipal supply hours, municipal water supply codes mandate minimum storage buffers:
- **Underground Sump**: Calculated at **1.5 times daily consumption** (36-hour reserve capacity).
- **Overhead Distribution Tank (OHT)**: Calculated at **0.5 times daily consumption** (12-hour overhead gravity head).
- **Pipe Caliber Guidance**:
  - $\le 800\text{ L/day}$: 0.5-inch (15 mm) connection ferrule.
  - $800 - 2,000\text{ L/day}$: 0.75-inch (20 mm) connection ferrule.
  - $> 2,000\text{ L/day}$: 1.0-inch (25 mm) commercial ferrule.

---

## Statutory Rainwater Harvesting (RWH) Credit
- Under state municipal bye-laws, plots exceeding **100 sq. meters** are legally mandated to install rainwater harvesting systems prior to connection sanction.
- Functional RWH structures yield up to **25% offset** against annual freshwater municipal draw requirements.
- Voluntary installation qualifies properties for green tariff concessions on municipal water billing.

---

## Locality Data & Hydraulic Disclaimers
> **Mandatory Statutory Notice**: Calculated figures represent indicative engineering estimates for architectural and plumbing planning. The visualizer does NOT verify hydraulic line pressure or guarantee municipal connection sanction, which remains subject to physical field inspection by the Junior Engineer. Unsupported localities return an explicit `LOCALITY_DATA_UNAVAILABLE` state rather than fabricating assumptions.
