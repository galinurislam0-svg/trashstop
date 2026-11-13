export type Category =
  | "household" // тұрмыстық қоқыс
  | "bulky" // ірі көлемді
  | "construction" // құрылыс қалдығы
  | "container" // толған контейнер
  | "car" // көліктен тасталған
  | "tree" // ағаш / жасыл аймақ
  | "burning"; // қоқыс / шөп өртеу, түтін

export type Status = "new" | "assigned" | "in_progress" | "done" | "rejected";

export type Source = "app" | "egov" | "bot" | "109" | "ai" | "plan";

export interface AiResult {
  category: Category;
  volume: "small" | "medium" | "large";
  hazard: "low" | "medium" | "high";
  confidence: number; // 0..1
  summary: string; // қысқаша сипаттама, қазақша
  plate?: string | null;
  demo?: boolean; // ЖИ қолжетімсіз — санатты тұрғын өзі таңдайды
  items?: string[]; // фотода көрінген заттар
  volumeM3?: number; // шамамен көлем, м³
  reason?: string; // неге осы санат
  needsRetake?: boolean; // фото жарамсыз — қайта түсіру керек
  retakeReason?: string | null;
}

export interface Verification {
  ok: boolean;
  distanceM: number;
  minutesAfterAssign: number;
  aiClean: boolean | null;
  reasons: string[];
}

export interface TimelineItem {
  at: number;
  text: string;
  kind: "create" | "ai" | "assign" | "start" | "done" | "reject" | "rate" | "merge";
}

export interface Report {
  id: string;
  code: string;
  createdAt: number;
  category: Category;
  status: Status;
  priority: 1 | 2 | 3; // 3 = жоғары
  priorityReason: string;
  lat: number;
  lng: number;
  address: string;
  district: string;
  description: string;
  source: Source;
  photo: string | null;
  ai: AiResult | null;
  brigadeId: string | null;
  workerId: string | null;
  deadline: number | null;
  assignedAt: number | null;
  startedAt: number | null;
  doneAt: number | null;
  afterPhoto: string | null;
  verification: Verification | null;
  rating: number | null;
  thanks: string | null;
  merged: number; // қанша шағым біріктірілді
  plate: string | null;
  reporterId?: string | null;
  timeline: TimelineItem[];
}

export interface Worker {
  id: string;
  name: string;
  age: number;
  brigadeId: string;
  rating: number;
  ratingsCount: number;
  thanks: number;
  tasksDone: number;
  onTimePct: number;
}

export interface Brigade {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  vehicle: string;
}

export type TreeHealth = "good" | "weak" | "dry";

export interface Tree {
  id: string;
  lat: number;
  lng: number;
  species: string;
  planted: number;
  health: TreeHealth;
  lastWatered: number;
  zone: string;
  contractor: string;
  autoIrrigation: boolean;
  checkedAt?: number; // маман соңғы рет тексерген уақыт
  checkNote?: string;
}

export interface CityState {
  users?: import("./auth").User[];
  reports: Report[];
  workers: Worker[];
  brigades: Brigade[];
  trees: Tree[];
  now: number;
}
