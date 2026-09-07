// 달력에서 날짜를 직접 클릭해 알바생별 근무일을 지정하고, 시급(13,000원, 1시간 무급 휴게 제외)을 자동 계산해 텍스트로 모아 복사하는 스케줄러
import { useState } from "react";

const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"]; // 달력 요일 헤더(일요일 시작)
const HOURLY_WAGE = 13000;
const WORKER_COLORS = [
  { chip: "bg-emerald-100 text-emerald-700", border: "border-emerald-400", bg: "bg-emerald-50" },
  { chip: "bg-amber-100 text-amber-700", border: "border-amber-400", bg: "bg-amber-50" },
  { chip: "bg-sky-100 text-sky-700", border: "border-sky-400", bg: "bg-sky-50" },
  { chip: "bg-rose-100 text-rose-700", border: "border-rose-400", bg: "bg-rose-50" },
  { chip: "bg-violet-100 text-violet-700", border: "border-violet-400", bg: "bg-violet-50" },
  { chip: "bg-slate-200 text-slate-700", border: "border-slate-400", bg: "bg-slate-100" },
];

function defaultTimesForDate(dateStr) {
  const dow = new Date(dateStr).getDay(); // 0=일 ... 6=토
  const isWeekendGroup = dow === 0 || dow === 5 || dow === 6; // 금토일
  return isWeekendGroup ? { start: "11:00", end: "20:30" } : { start: "11:00", end: "20:00" };
}

function calcHours(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em - (sh * 60 + sm)) / 60 - 1; // 1시간 무급 휴게 제외
  return diff > 0 ? Math.round(diff * 100) / 100 : 0;
}

function workerSummary(w) {
  let hours = 0;
  Object.values(w.dates).forEach((t) => {
    hours += calcHours(t.start, t.end);
  });
  hours = Math.round(hours * 100) / 100;
  return { hours, wage: Math.round(hours * HOURLY_WAGE) };
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW_LABELS[d.getDay()]})`;
}

function generateText(workers, monthDate) {
  const lines = [`[${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월 근무 스케줄]`, ""];
  workers.forEach((w) => {
    const dateKeys = Object.keys(w.dates).sort();
    if (!w.name && dateKeys.length === 0) return;
    lines.push(`■ ${w.name || "이름 미입력"}`);
    dateKeys.forEach((dateStr) => {
      const t = w.dates[dateStr];
      const h = calcHours(t.start, t.end);
      lines.push(`  ${formatDateLabel(dateStr)} ${t.start}~${t.end} (${h}시간)`);
    });
    const { hours, wage } = workerSummary(w);
    lines.push(`  이번 달 합계: ${hours}시간 / ${wage.toLocaleString()}원`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

function getCalendarCells(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function toDateStr(year, monthIndex, day) {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export default function Scheduler() {
  const [workers, setWorkers] = useState([{ id: 1, name: "", dates: {} }]);
  const [nextId, setNextId] = useState(2);
  const [activeWorkerId, setActiveWorkerId] = useState(1);
  const [copiedAll, setCopiedAll] = useState(false);
  const [monthDate, setMonthDate] = useState(new Date(2026, 8, 1)); // 2026년 9월

  const addWorker = () => {
    const id = nextId;
    setWorkers((prev) => [...prev, { id, name: "", dates: {} }]);
    setNextId((n) => n + 1);
    setActiveWorkerId(id);
  };

  const duplicateWorker = (id) => {
    const w = workers.find((w) => w.id === id);
    if (!w) return;
    const newId = nextId;
    setWorkers((prev) => [...prev, { id: newId, name: "", dates: JSON.parse(JSON.stringify(w.dates)) }]);
    setNextId((n) => n + 1);
    setActiveWorkerId(newId);
  };

  const removeWorker = (id) => {
    setWorkers((prev) => {
      const next = prev.filter((w) => w.id !== id);
      if (activeWorkerId === id && next.length > 0) setActiveWorkerId(next[0].id);
      return next;
    });
  };

  const updateName = (id, name) => {
    setWorkers((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)));
  };

  const toggleDate = (id, dateStr) => {
    setWorkers((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const dates = { ...w.dates };
        if (dates[dateStr]) {
          delete dates[dateStr];
        } else {
          dates[dateStr] = defaultTimesForDate(dateStr);
        }
        return { ...w, dates };
      })
    );
  };

  const updateDateTime = (id, dateStr, field, value) => {
    setWorkers((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        return { ...w, dates: { ...w.dates, [dateStr]: { ...w.dates[dateStr], [field]: value } } };
      })
    );
  };

  const copyAll = async () => {
    const text = generateText(workers, monthDate);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch (e) {
      // 클립보드 접근 실패 시 무시
    }
  };

  const changeMonth = (delta) => {
    setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const activeWorker = workers.find((w) => w.id === activeWorkerId);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const activeDateKeys = activeWorker ? Object.keys(activeWorker.dates).sort() : [];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-slate-800 mb-1">알바 근무 스케줄러</h1>
        <p className="text-sm text-slate-500 mb-6">시급 13,000원 · 휴게 1시간 무급 · 달력에서 근무일 클릭</p>

        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">근무자</h2>
          <div className="space-y-2">
            {workers.map((w, idx) => {
              const color = WORKER_COLORS[idx % WORKER_COLORS.length];
              const isActive = w.id === activeWorkerId;
              return (
                <div
                  key={w.id}
                  onClick={() => setActiveWorkerId(w.id)}
                  className={
                    "flex items-center gap-2 rounded-lg border p-2 cursor-pointer " +
                    (isActive ? color.border + " " + color.bg : "border-slate-200 bg-white")
                  }
                >
                  <span className={"w-3 h-3 rounded-full flex-shrink-0 " + color.chip.split(" ")[0]} />
                  <input
                    type="text"
                    value={w.name}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateName(w.id, e.target.value)}
                    placeholder="이름"
                    className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
                  />
                  <span className="text-xs text-slate-500 tabular-nums">
                    {workerSummary(w).hours}시간 · {workerSummary(w).wage.toLocaleString()}원
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateWorker(w.id);
                    }}
                    className="text-xs text-slate-500 border border-slate-300 rounded px-2 py-1.5 hover:bg-slate-50"
                  >
                    복사
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWorker(w.id);
                    }}
                    className="text-xs text-red-500 border border-red-200 rounded px-2 py-1.5 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={addWorker}
            className="mt-3 w-full border border-dashed border-slate-300 rounded-lg py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600"
          >
            + 알바생 추가
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => changeMonth(-1)} className="text-slate-400 hover:text-slate-600 px-2 py-1">
              이전
            </button>
            <span className="text-sm font-semibold text-slate-800">
              {year}년 {monthIndex + 1}월 ·{" "}
              <span className="text-slate-500 font-normal">
                {activeWorker ? activeWorker.name || "이름 미입력" : "근무자 없음"} 근무일 선택 중
              </span>
            </span>
            <button onClick={() => changeMonth(1)} className="text-slate-400 hover:text-slate-600 px-2 py-1">
              다음
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DOW_LABELS.map((label, i) => (
              <div
                key={label}
                className={
                  "text-center text-xs font-medium py-1 " +
                  (i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500")
                }
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {getCalendarCells(year, monthIndex).map((day, idx) => {
              if (day === null) return <div key={idx} />;
              const dateStr = toDateStr(year, monthIndex, day);
              const dow = new Date(year, monthIndex, day).getDay();
              const assignedWorkers = workers.filter((w) => w.dates[dateStr]);
              const activeAssigned = activeWorker && activeWorker.dates[dateStr];
              const activeColor = WORKER_COLORS[workers.findIndex((w) => w.id === activeWorkerId) % WORKER_COLORS.length];
              return (
                <div
                  key={idx}
                  onClick={() => activeWorker && toggleDate(activeWorkerId, dateStr)}
                  className={
                    "min-h-16 border rounded p-1 cursor-pointer " +
                    (activeAssigned ? activeColor.border + " " + activeColor.bg : "border-slate-100 hover:bg-slate-50")
                  }
                >
                  <div
                    className={
                      "text-xs mb-0.5 " +
                      (dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-slate-400")
                    }
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {assignedWorkers.map((w) => {
                      const colorIdx = workers.findIndex((ww) => ww.id === w.id) % WORKER_COLORS.length;
                      return (
                        <div
                          key={w.id}
                          className={"text-xs rounded px-1 truncate " + WORKER_COLORS[colorIdx].chip}
                        >
                          {w.name || "이름 미입력"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {activeWorker && activeDateKeys.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">
              {activeWorker.name || "이름 미입력"}의 이번 달 근무일
            </h2>
            <div className="space-y-1.5">
              {activeDateKeys.map((dateStr) => {
                const t = activeWorker.dates[dateStr];
                return (
                  <div key={dateStr} className="flex items-center gap-2 text-sm">
                    <span className="w-16 text-slate-600 font-medium">{formatDateLabel(dateStr)}</span>
                    <input
                      type="time"
                      value={t.start}
                      onChange={(e) => updateDateTime(activeWorkerId, dateStr, "start", e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-sm tabular-nums"
                    />
                    <span className="text-slate-400">~</span>
                    <input
                      type="time"
                      value={t.end}
                      onChange={(e) => updateDateTime(activeWorkerId, dateStr, "end", e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-sm tabular-nums"
                    />
                    <span className="text-slate-400 ml-auto tabular-nums">{calcHours(t.start, t.end)}시간</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">전송용 내용</h2>
            <button
              onClick={copyAll}
              className="text-xs bg-emerald-600 text-white rounded px-3 py-1.5 hover:bg-emerald-700"
            >
              {copiedAll ? "복사됨" : "전체 복사"}
            </button>
          </div>
          <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-3 max-h-64 overflow-y-auto">
            {generateText(workers, monthDate)}
          </pre>
        </div>
      </div>
    </div>
  );
}
