import {
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Camera,
  MapPin,
  Flame,
  Droplets,
  Users,
} from 'lucide-react';

const MANDATORY_SOLID_WASTE_DOCUMENTS = [
  {
    id: 'geotagged_photos',
    title: 'Geo-Tagged Photographs with Date & Time Watermark',
    description: 'High-resolution photographs of waste mounds with GPS coordinates and timestamps.',
    icon: Camera,
    weight: 25,
  },
  {
    id: 'gps_coordinate_proof',
    title: 'Precise GPS Pin & Satellite Map Overlay',
    description: 'Latitude and longitude coordinates identifying plot boundaries and adjoining roads.',
    icon: MapPin,
    weight: 20,
  },
  {
    id: 'municipal_grievance_ack',
    title: 'Prior Municipal Grievance Docket / Service Request',
    description: 'Complaint reference number filed via Swachhata App, Municipal WhatsApp, or Portal.',
    icon: FileCheck,
    weight: 20,
  },
  {
    id: 'burning_or_smoke_evidence',
    title: 'Photographic / Video Evidence of Open Burning',
    description: 'Time-stamped recording of burning plumes, charred residue, or air pollution.',
    icon: Flame,
    weight: 15,
  },
  {
    id: 'leachate_or_drain_ingress',
    title: 'Toxic Leachate Ingress Evidence',
    description: 'Visual evidence of black leachate seeping into stormwater drains or soil.',
    icon: Droplets,
    weight: 10,
  },
  {
    id: 'rwa_resolution_copy',
    title: 'RWA / Citizen Collective Formal Resolution',
    description: 'Signed petition or resolution by neighborhood residents verifying persistent nuisance.',
    icon: Users,
    weight: 10,
  },
];

export default function SolidWasteEvidenceChecklist({
  checklistState = {},
  onToggleItem,
}) {
  const readinessScore = MANDATORY_SOLID_WASTE_DOCUMENTS.reduce((acc, doc) => {
    return acc + (checklistState[doc.id] ? doc.weight : 0);
  }, 0);

  const isReadyForLitigation = readinessScore >= 65;

  return (
    <div className="space-y-6" data-testid="solid-waste-evidence-checklist">
      {/* Header Banner */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-600" />
              Evidentiary Readiness &amp; Document Checklist
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Statutory documents required for submission before Municipal Commissioners, SPCB, and the National Green Tribunal.
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
              Readiness Score
            </span>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {readinessScore}%
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full mt-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isReadyForLitigation ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${readinessScore}%` }}
          />
        </div>

        <div className="mt-2 text-xs flex items-center justify-between text-gray-500">
          <span>Minimum 65% recommended for NGT Section 14 Application</span>
          <span>{isReadyForLitigation ? 'Ready for Legal Representation' : 'Evidence Gathering Required'}</span>
        </div>
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MANDATORY_SOLID_WASTE_DOCUMENTS.map((item) => {
          const isChecked = Boolean(checklistState[item.id]);
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              onClick={() => typeof onToggleItem === 'function' && onToggleItem(item.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                isChecked
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isChecked ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-gray-500" />
                    {item.title}
                  </h4>
                  <span className="text-xs font-mono text-gray-400">+{item.weight}%</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
