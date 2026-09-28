"""소형 코인 스크리너 v1 — DefiLlama 무료 API + CoinGecko 무료 API(FDV·mcap 보강).

실행: python screener/screener.py   (표준 라이브러리만 사용)
출력: screener/output/latest.{csv,md} + screener/output/history/YYYY-MM-DD.{csv,md}
"""

from __future__ import annotations

import csv
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = "https://api.llama.fi"
OVERVIEW = API + "/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType={dt}"
SUMMARY = API + "/summary/fees/{slug}?dataType=dailyRevenue"
CG_MARKETS = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&ids={ids}"
CG_BATCH = 250
MCAP_MISMATCH = 0.3  # DefiLlama·CoinGecko mcap 차이가 30% 넘으면 플래그
LOW_FLOAT = 0.25  # 유통비율(mcap/FDV) 25% 미만이면 플래그

MCAP_MIN, MCAP_MAX = 5_000_000, 100_000_000
REV30_MIN = 50_000
TREND_MIN = 1.0
VALIDATION_NAME = "Infinex"

KST = timezone(timedelta(hours=9))
OUT_DIR = Path(__file__).resolve().parent / "output"


def get_json(url: str, retries: int = 4, headers: dict | None = None):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "flowsignal-screener/1.0", **(headers or {})})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1 or (isinstance(e, urllib.error.HTTPError) and 400 <= e.code < 500 and e.code != 429):
                raise
            rate_limited = isinstance(e, urllib.error.HTTPError) and e.code == 429
            wait = 30 * (attempt + 1) if rate_limited else 2 ** attempt * 3
            print(f"  retry {attempt + 1} ({e}) in {wait}s: {url}", file=sys.stderr)
            time.sleep(wait)


def num(x) -> float:
    try:
        v = float(x)
        return v if math.isfinite(v) else 0.0
    except (TypeError, ValueError):
        return 0.0


def has_token(meta: dict) -> bool:
    sym = (meta.get("symbol") or "").strip()
    return bool(meta.get("gecko_id") or meta.get("geckoId") or (sym and sym != "-"))


def gecko_id(meta: dict) -> str | None:
    return meta.get("gecko_id") or meta.get("geckoId") or None


def fetch_coingecko(ids: list[str]) -> tuple[dict, str]:
    """CoinGecko /coins/markets 배치 조회. (id → market 데이터, 상태 메시지). 실패해도 중단하지 않음."""
    key = os.environ.get("COINGECKO_API_KEY", "").strip()
    headers = {"x-cg-demo-api-key": key} if key else None
    out: dict[str, dict] = {}
    failed = 0
    batches = [ids[i:i + CG_BATCH] for i in range(0, len(ids), CG_BATCH)]
    for n, batch in enumerate(batches):
        if n:
            time.sleep(3 if key else 15)  # 무키 무료 한도(분당 약 5~15회) 대비
        try:
            for m in get_json(CG_MARKETS.format(ids=",".join(batch)), retries=5, headers=headers):
                out[m["id"]] = m
        except Exception as ex:  # noqa: BLE001
            failed += 1
            print(f"  ! CoinGecko batch {n + 1}/{len(batches)} failed: {ex}", file=sys.stderr)
    status = f"CoinGecko {len(out)}/{len(ids)}개 조회" + (f" (배치 {failed}개 실패)" if failed else "")
    return out, status


def monthly_trend(chart: list, today: datetime) -> tuple[float | None, list]:
    """완결된 달 기준: 최근 3개월 월평균 ÷ 그 전 3개월 월평균. 진행 중인 이번 달은 제외."""
    months: dict[str, float] = defaultdict(float)
    for ts, v in chart:
        months[datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m")] += num(v)
    cur = today.strftime("%Y-%m")
    done = sorted(m for m in months if m < cur)
    if len(done) < 6:
        return None, done
    recent, prev = done[-3:], done[-6:-3]
    prev_avg = sum(months[m] for m in prev) / 3
    recent_avg = sum(months[m] for m in recent) / 3
    if prev_avg <= 0:
        return (math.inf if recent_avg > 0 else None), done
    return recent_avg / prev_avg, done


def main() -> int:
    now = datetime.now(KST)
    print(f"[{now:%Y-%m-%d %H:%M} KST] fetching DefiLlama ...")

    rev = get_json(OVERVIEW.format(dt="dailyRevenue"))["protocols"]
    fees = get_json(OVERVIEW.format(dt="dailyFees"))["protocols"]
    holders = get_json(OVERVIEW.format(dt="dailyHoldersRevenue"))["protocols"]
    protocols = get_json(API + "/protocols")
    lite = get_json(API + "/lite/protocols2")
    print(f"  revenue={len(rev)} fees={len(fees)} holders={len(holders)} protocols={len(protocols)} parents={len(lite['parentProtocols'])}")

    proto_by_id = {str(p.get("id")): p for p in protocols}
    parent_meta = {p["id"]: p for p in lite["parentProtocols"]}
    fees30 = {str(p["defillamaId"]): num(p.get("total30d")) for p in fees}
    hold30 = {str(p["defillamaId"]): num(p.get("total30d")) for p in holders}

    # 자식 프로토콜 매출을 부모(토큰 보유 단위)로 합산
    ents: dict[str, dict] = {}
    for p in rev:
        if p.get("protocolType", "protocol") != "protocol":
            continue
        pid = str(p["defillamaId"])
        parent = p.get("parentProtocol")
        key = parent or pid
        e = ents.get(key)
        if e is None:
            if parent:
                meta = parent_meta.get(parent, {})
                slug = parent.split("#", 1)[1]
                name = meta.get("name") or slug
                mcap = num(meta.get("mcap"))
            else:
                meta = proto_by_id.get(pid, {})
                slug = p.get("slug")
                name = p.get("displayName") or p.get("name")
                mcap = num(meta.get("mcap"))
            e = ents[key] = {
                "key": key, "name": name, "slug": slug, "meta": meta,
                "mcap": mcap, "fdv": num(meta.get("fdv")),
                "rev_30d": 0.0, "fees_30d": 0.0, "holders_rev_30d": 0.0,
                "children": [], "child_slugs": [], "cat_rev": defaultdict(float), "chains": set(),
            }
        r30 = num(p.get("total30d"))
        e["rev_30d"] += r30
        e["fees_30d"] += fees30.get(pid, 0.0)
        e["holders_rev_30d"] += hold30.get(pid, 0.0)
        e["children"].append(p.get("name"))
        e["child_slugs"].append(p.get("slug"))
        e["cat_rev"][p.get("category") or "Unknown"] += r30 + 1e-9
        e["chains"].update(p.get("chains") or [])
        child = proto_by_id.get(pid, {})
        e["chains"].update(child.get("chains") or [])
        if not e["mcap"]:  # 부모 mcap 없으면 자식 mcap 보조 사용
            e["mcap"] = max(e["mcap"], num(child.get("mcap")))
        if not e["fdv"]:
            e["fdv"] = max(e["fdv"], num(child.get("fdv")))
        if not has_token(e["meta"]) and has_token(child):
            e["meta"] = child

    # CoinGecko로 FDV·mcap 보강 (DefiLlama mcap도 원래 CoinGecko 유래 — 더 최신 값으로 교체)
    ids = sorted({gid for e in ents.values() if has_token(e["meta"]) and (gid := gecko_id(e["meta"]))})
    print(f"  fetching CoinGecko markets for {len(ids)} tokens ...")
    cg, cg_status = fetch_coingecko(ids)
    print(f"  {cg_status}")

    for e in ents.values():
        e["category"] = max(e["cat_rev"], key=e["cat_rev"].get)
        e["rev_annual"] = e["rev_30d"] * 12
        e["dl_mcap"] = e["mcap"]
        e["mcap_src"] = "DefiLlama" if e["mcap"] else "-"
        e["flags"] = []
        m = cg.get(gecko_id(e["meta"]) or "")
        if m:
            cg_mcap, cg_fdv = num(m.get("market_cap")), num(m.get("fully_diluted_valuation"))
            if cg_mcap > 0:
                if e["dl_mcap"] > 0 and abs(cg_mcap - e["dl_mcap"]) / e["dl_mcap"] > MCAP_MISMATCH:
                    e["flags"].append("mcap불일치")
                e["mcap"], e["mcap_src"] = cg_mcap, "CoinGecko"
            if cg_fdv > 0:
                e["fdv"] = cg_fdv
        e["circ"] = e["mcap"] / e["fdv"] if e["mcap"] > 0 and e["fdv"] > 0 else None
        if e["circ"] is not None and e["circ"] < LOW_FLOAT:
            e["flags"].append(f"유통<{LOW_FLOAT:.0%}")
        if e["fdv"] > 0:
            e["pf_basis"], base = "FDV", e["fdv"]
        else:
            e["pf_basis"], base = "mcap", e["mcap"]
        ok = e["rev_annual"] > 0
        e["pf"] = base / e["rev_annual"] if ok and base > 0 else None
        e["pf_mcap"] = e["mcap"] / e["rev_annual"] if ok and e["mcap"] > 0 else None
        if e["pf"] is not None and e["pf"] < 1:
            e["flags"].append("pf<1 데이터확인")
        e["trend"] = None
        e["months"] = []

    # 필터 퍼널 (단계별 탈락 개수 기록)
    funnel = [("대상 (매출 보고 프로토콜, 부모 단위 합산)", len(ents))]
    pool = list(ents.values())

    def step(label, pred):
        nonlocal pool
        kept = [e for e in pool if pred(e)]
        funnel.append((label, len(pool) - len(kept)))
        pool = kept

    step("토큰 없음", lambda e: has_token(e["meta"]))
    step(f"mcap {MCAP_MIN/1e6:.0f}M~{MCAP_MAX/1e6:.0f}M 범위 밖 (mcap 미상 포함)",
         lambda e: MCAP_MIN <= e["mcap"] <= MCAP_MAX)
    step(f"rev_30d < ${REV30_MIN:,}", lambda e: e["rev_30d"] >= REV30_MIN)

    # 추세: 후보 + 검증 대상만 시계열 호출
    validation = [e for e in ents.values() if e["name"] == VALIDATION_NAME]
    need = {e["key"]: e for e in pool + validation}
    print(f"  fetching monthly series for {len(need)} entities ...")
    for e in need.values():
        try:
            chart = get_json(SUMMARY.format(slug=e["slug"])).get("totalDataChart") or []
        except Exception as ex:  # noqa: BLE001
            # 부모 slug 조회 실패 시 자식 시계열을 합산
            print(f"  ! summary failed for {e['slug']} ({ex}); merging children", file=sys.stderr)
            chart = []
            for cs in e["child_slugs"]:
                if cs == e["slug"]:
                    continue
                try:
                    chart += get_json(SUMMARY.format(slug=cs)).get("totalDataChart") or []
                except Exception as ex2:  # noqa: BLE001
                    print(f"  ! summary failed for child {cs}: {ex2}", file=sys.stderr)
                time.sleep(0.25)
        if chart:
            e["trend"], e["months"] = monthly_trend(chart, now)
        time.sleep(0.25)

    step("trend 계산 불가 (완결 월 6개 미만/데이터 없음)", lambda e: e["trend"] is not None)
    step(f"trend < {TREND_MIN}", lambda e: e["trend"] >= TREND_MIN)
    funnel.append(("최종 통과", len(pool)))

    rows = sorted(pool, key=lambda e: (e["pf"] is None, e["pf"] or 0))
    by_cat = defaultdict(list)
    for e in rows:
        by_cat[e["category"]].append(e)
    for cat_rows in by_cat.values():
        cat_rows.sort(key=lambda e: (e["pf"] is None, e["pf"] or 0))
        for i, e in enumerate(cat_rows, 1):
            e["cat_rank"] = f"{i}/{len(cat_rows)}"

    write_outputs(rows, funnel, validation, now, cg_status)
    for label, n in funnel:
        print(f"  {label}: {n}")
    for v in validation:
        print(f"  [검증] {v['name']}: mcap={v['mcap']:,.0f} fdv={v['fdv']:,.0f} rev_30d={v['rev_30d']:,.0f} "
              f"pf({v['pf_basis']})={fmt_x(v['pf'])} pf_mcap={fmt_x(v['pf_mcap'])} trend={fmt_t(v['trend'])}")
    return 0


def fmt_usd(v: float) -> str:
    if not v:
        return "-"
    for d, s in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if v >= d:
            return f"${v / d:.2f}{s}"
    return f"${v:.0f}"


def fmt_x(v) -> str:
    return "-" if v is None else f"{v:.1f}x"


def fmt_t(v) -> str:
    if v is None:
        return "-"
    return "∞" if v == math.inf else f"{v:.2f}"


def link(e) -> str:
    return f"https://defillama.com/protocol/{e['slug']}"


CSV_COLS = ["rank", "name", "category", "mcap", "mcap_src", "defillama_mcap", "fdv", "circ_ratio", "pf_basis",
            "rev_30d", "rev_annual", "fees_30d", "trend", "pf", "pf_mcap", "holders_rev_30d", "category_pf_rank",
            "flags", "symbol", "gecko_id", "chains", "children", "defillama_url"]


def csv_row(i, e) -> list:
    return [
        i, e["name"], e["category"], round(e["mcap"]), e["mcap_src"], round(e["dl_mcap"]),
        round(e["fdv"]) if e["fdv"] else "", "" if e["circ"] is None else round(e["circ"], 3),
        e["pf_basis"], round(e["rev_30d"]), round(e["rev_annual"]), round(e["fees_30d"]),
        "" if e["trend"] is None else ("inf" if e["trend"] == math.inf else round(e["trend"], 3)),
        "" if e["pf"] is None else round(e["pf"], 2), "" if e["pf_mcap"] is None else round(e["pf_mcap"], 2),
        round(e["holders_rev_30d"]), e.get("cat_rank", ""), ";".join(e["flags"]),
        e["meta"].get("symbol") or "", gecko_id(e["meta"]) or "", ";".join(sorted(e["chains"])),
        ";".join(e["children"]), link(e),
    ]


def md_table(rows, ranked=True) -> list[str]:
    head = ("| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | "
            "holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |")
    out = [head, "|" + "---|" * 14]
    for i, e in enumerate(rows, 1):
        circ = "-" if e["circ"] is None else f"{e['circ']:.0%}"
        out.append(
            f"| {i if ranked else '-'} | {e['name']} | {e['category']} | {fmt_usd(e['mcap'])} | "
            f"{fmt_usd(e['fdv']) if e['fdv'] else '-'} | {circ} | {fmt_usd(e['rev_30d'])} | {fmt_t(e['trend'])} | "
            f"{fmt_x(e['pf'])} ({e['pf_basis']}) | {fmt_x(e['pf_mcap'])} | {fmt_usd(e['holders_rev_30d'])} | "
            f"{e.get('cat_rank', '-')} | {', '.join(e['flags']) or '-'} | [DefiLlama]({link(e)}) |"
        )
    return out


def write_outputs(rows, funnel, validation, now, cg_status) -> None:
    (OUT_DIR / "history").mkdir(parents=True, exist_ok=True)
    date = now.strftime("%Y-%m-%d")

    csv_path = OUT_DIR / "latest.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(CSV_COLS)
        for i, e in enumerate(rows, 1):
            w.writerow(csv_row(i, e))

    fdv_n = sum(1 for e in rows if e["pf_basis"] == "FDV")
    md = [
        f"# 소형 코인 스크리너 — {date}",
        "",
        f"생성: {now:%Y-%m-%d %H:%M} KST · 출처: DefiLlama 무료 API (`/overview/fees`, `/protocols`, `/lite/protocols2`, `/summary/fees/{{slug}}`) + CoinGecko 무료 API (`/coins/markets`) — {cg_status}",
        "",
        f"필터: mcap ${MCAP_MIN/1e6:.0f}M~${MCAP_MAX/1e6:.0f}M · rev_30d ≥ ${REV30_MIN:,} · trend ≥ {TREND_MIN} · 토큰 보유",
        "",
        "- rev = DefiLlama `dailyRevenue`, 자식 프로토콜은 부모(토큰) 단위로 합산",
        "- rev_annual = rev_30d × 12 · pf = FDV(없으면 mcap) ÷ rev_annual — `(기준)` 표시",
        "- trend = 최근 완결 3개월 월평균 ÷ 그 전 3개월 월평균 (진행 중인 달 제외)",
        "- mcap·FDV = CoinGecko 값 우선 (없으면 DefiLlama mcap) · 유통비율 = mcap ÷ FDV · pf_mcap = mcap ÷ rev_annual",
        f"- 플래그: `mcap불일치` DefiLlama·CoinGecko mcap 차이 >{MCAP_MISMATCH:.0%} (토큰 매핑 오류 의심) · "
        f"`유통<{LOW_FLOAT:.0%}` 향후 언락 희석 위험 · `pf<1 데이터확인` 매출 과대집계 의심",
        f"- FDV 기준 행: {fdv_n}/{len(rows)}",
        "",
        f"## 결과 ({len(rows)}개, pf 오름차순)",
        "",
        *md_table(rows),
        "",
        "## 필터 단계별 탈락",
        "",
        "| 단계 | 개수 |",
        "|---|---|",
        *[f"| {label} | {n} |" for label, n in funnel],
        "",
        f"## 검증 행: {VALIDATION_NAME} (필터 무관)",
        "",
        *(md_table(validation, ranked=False) if validation else ["(찾을 수 없음)"]),
        "",
    ]
    if validation:
        v = validation[0]
        md += [f"- 사용한 완결 월: {', '.join(v['months'][-6:]) or '-'} · 합산 자식: {', '.join(v['children'])}", ""]
    md_path = OUT_DIR / "latest.md"
    md_path.write_text("\n".join(md), encoding="utf-8")

    (OUT_DIR / "history" / f"{date}.csv").write_bytes(csv_path.read_bytes())
    (OUT_DIR / "history" / f"{date}.md").write_bytes(md_path.read_bytes())
    print(f"  wrote {csv_path}, {md_path} (+ history/{date}.*)")


if __name__ == "__main__":
    sys.exit(main())
