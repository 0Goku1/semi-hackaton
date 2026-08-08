import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Code,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type TabId = "diagnosis" | "goal" | "requirements" | "gantt" | "gates" | "details";

const TABS: { id: TabId; label: string }[] = [
  { id: "diagnosis", label: "1. 현재 진단" },
  { id: "goal", label: "2. 목표 재정의" },
  { id: "requirements", label: "3. 요구사항" },
  { id: "gantt", label: "4. 간트차트" },
  { id: "gates", label: "5. 게이트" },
  { id: "details", label: "6. 실무 디테일" },
];

const DAYS = [
  "08/06", "08/07", "08/08", "08/09", "08/10", "08/11", "08/12",
  "08/13", "08/14", "08/15", "08/16", "08/17", "08/18", "08/19",
  "08/20", "08/21", "08/22", "08/23", "08/24", "08/25", "08/26", "08/27",
];

type Bar = { id: string; label: string; start: number; len: number; crit?: boolean };
type Track = { name: string; owner: string; bars: Bar[] };

const TRACKS: Track[] = [
  {
    name: "A. 데이터 확보",
    owner: "데이터",
    bars: [
      { id: "D1", label: "D1 산불이력 확보", start: 0, len: 2, crit: true },
      { id: "D2", label: "D2 기상이력 확보", start: 0, len: 3, crit: true },
      { id: "D3", label: "D3 공간데이터 재확보", start: 0, len: 2 },
      { id: "D4", label: "D4 화성 4구 경계", start: 2, len: 2 },
      { id: "D5", label: "D5 인적노출 데이터", start: 2, len: 3, crit: true },
      { id: "D6", label: "D6 OSM 도로망", start: 4, len: 2 },
      { id: "D7", label: "D7 실시간 기상 API키", start: 4, len: 1 },
    ],
  },
  {
    name: "B. 전처리 · 모델",
    owner: "모델",
    bars: [
      { id: "P1", label: "P1 정적피처 1,553셀", start: 0, len: 4 },
      { id: "P2", label: "P2 기상 파서·정제", start: 5, len: 2 },
      { id: "P5", label: "P5 인적노출 격자화", start: 5, len: 2 },
      { id: "P3", label: "P3 기상 파생변수", start: 7, len: 3 },
      { id: "P4", label: "P4 동네예보·IDW조인", start: 9, len: 2, crit: true },
      { id: "P8", label: "P8 기상불확실성피처", start: 9, len: 2, crit: true },
      { id: "P6", label: "P6 라벨링·음성표본", start: 9, len: 2, crit: true },
      { id: "M1", label: "M1 베이스라인 3종", start: 10, len: 2 },
      { id: "P7", label: "P7 누출 감사", start: 11, len: 1, crit: true },
      { id: "M2", label: "M2 LightGBM 학습", start: 11, len: 3, crit: true },
      { id: "M3", label: "M3 공간블록 CV", start: 12, len: 2 },
      { id: "M4", label: "M4 캘리브레이션·5등급", start: 13, len: 2, crit: true },
      { id: "M5", label: "M5 평가 리포트", start: 14, len: 2 },
      { id: "M6", label: "M6 SHAP 설명", start: 15, len: 1 },
    ],
  },
  {
    name: "C. 동선 최적화",
    owner: "동선",
    bars: [
      { id: "R1", label: "R1 이동 그래프 구축", start: 1, len: 3 },
      { id: "R3", label: "R3 이동시간 행렬", start: 4, len: 2 },
      { id: "R2", label: "R2 격자→노드 스냅", start: 13, len: 2 },
      { id: "R4", label: "R4 OR-Tools TOP", start: 14, len: 3, crit: true },
      { id: "R5", label: "R5 순찰유형 3단계", start: 16, len: 2 },
      { id: "R10", label: "R10 불확실성페널티감쇠", start: 16, len: 2 },
      { id: "R6", label: "R6 GeoJSON 출력", start: 16, len: 2 },
    ],
  },
  {
    name: "D. 백엔드",
    owner: "백엔드",
    bars: [
      { id: "B1", label: "B1 PostGIS 스키마", start: 1, len: 3 },
      { id: "B8", label: "B8 정형관측 API", start: 3, len: 3, crit: true },
      { id: "B4", label: "B4 요원 GPS API", start: 5, len: 2 },
      { id: "B9", label: "B9 플래그가산엔진", start: 6, len: 3, crit: true },
      { id: "B2", label: "B2 위험도 조회 API", start: 13, len: 3, crit: true },
      { id: "B3", label: "B3 동선 배정 API", start: 16, len: 3, crit: true },
      { id: "B6", label: "B6 실시간 기상 배치", start: 18, len: 2 },
    ],
  },
  {
    name: "E. 앱",
    owner: "앱",
    bars: [
      { id: "A1", label: "A1 더미 제거·API스텁", start: 1, len: 3 },
      { id: "F1", label: "F1 플래그택소노미", start: 1, len: 2, crit: true },
      { id: "A8", label: "A8 체크리스트보고서", start: 3, len: 4, crit: true },
      { id: "A4", label: "A4 순찰 GPS 트래킹", start: 6, len: 3 },
      { id: "A9", label: "A9 동료플래그오버레이", start: 10, len: 3 },
      { id: "A2", label: "A2 위험격자 지도표출", start: 15, len: 3, crit: true },
      { id: "A3", label: "A3 동선 표출", start: 17, len: 2, crit: true },
      { id: "A10", label: "A10 인근플래그알림", start: 17, len: 2 },
      { id: "A5", label: "A5 보고서 실경로", start: 18, len: 2 },
      { id: "A7", label: "A7 오프라인 캐시", start: 18, len: 2 },
    ],
  },
  {
    name: "F. 발표 준비",
    owner: "앱·백엔드",
    bars: [
      { id: "O1", label: "O1 재현 파이프라인", start: 14, len: 3 },
      { id: "O2", label: "O2 시연 시나리오·폴백", start: 17, len: 3, crit: true },
      { id: "O4", label: "O4 지표 대시보드", start: 18, len: 2 },
      { id: "O3", label: "O3 한계 슬라이드", start: 19, len: 1 },
      { id: "RH", label: "리허설·안정화", start: 19, len: 2, crit: true },
    ],
  },
];

const MILESTONES = [
  { day: 1, code: "G1", label: "산불이력 결판" },
  { day: 6, code: "G2", label: "정적기반 완료" },
  { day: 11, code: "G3", label: "베이스라인 초과" },
  { day: 16, code: "G4", label: "앱 실API 연동" },
  { day: 18, code: "G5", label: "리허설 성공" },
  { day: 21, code: "★", label: "최종 발표" },
];

function TabNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <Row gap={6} wrap>
      {TABS.map((t) => (
        <Pill key={t.id} active={active === t.id} onClick={() => onChange(t.id)}>
          {t.label}
        </Pill>
      ))}
    </Row>
  );
}

function GanttChart() {
  const theme = useHostTheme();
  const labelW = 150;
  const dayW = 27;
  const rowH = 18;
  const headH = 42;
  const trackHeadH = 20;

  const totalRows = TRACKS.reduce((n, t) => n + t.bars.length, 0);
  const chartH = headH + totalRows * rowH + TRACKS.length * trackHeadH + 26;
  const chartW = labelW + DAYS.length * dayW + 12;

  const critColor = theme.diff.stripRemoved;
  const barColor = theme.accent.primary;

  let y = headH;
  const rendered: React.ReactNode[] = [];

  TRACKS.forEach((track) => {
    const trackY = y;
    rendered.push(
      <g key={`t-${track.name}`}>
        <rect
          x={0}
          y={trackY}
          width={chartW}
          height={trackHeadH}
          fill={theme.fill.tertiary}
        />
        <text x={8} y={trackY + 14} fill={theme.text.primary} fontSize={11} fontWeight={600}>
          {track.name}
        </text>
        <text x={labelW - 8} y={trackY + 14} fill={theme.text.tertiary} fontSize={10} textAnchor="end">
          {track.owner}
        </text>
      </g>,
    );
    y += trackHeadH;

    track.bars.forEach((bar) => {
      const bx = labelW + bar.start * dayW;
      const bw = bar.len * dayW - 3;
      rendered.push(
        <g key={bar.id}>
          <text x={12} y={y + 13} fill={theme.text.secondary} fontSize={10}>
            {bar.label}
          </text>
          <rect
            x={bx}
            y={y + 3}
            width={bw}
            height={rowH - 7}
            rx={2}
            fill={bar.crit ? critColor : barColor}
            opacity={bar.crit ? 0.95 : 0.55}
          />
          <text
            x={bx + bw + 5}
            y={y + 13}
            fill={theme.text.quaternary}
            fontSize={9}
          >
            {bar.len}d
          </text>
        </g>,
      );
      y += rowH;
    });
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={chartW}
        height={chartH}
        viewBox={`0 0 ${chartW} ${chartH}`}
        aria-label="3주 실행 간트차트 — 트랙별 작업 일정 (2026-08-06 ~ 08-27)"
      >
        <rect x={0} y={0} width={chartW} height={chartH} fill={theme.bg.editor} />

        {DAYS.map((d, i) => {
          const x = labelW + i * dayW;
          const isWeekBreak = i === 7 || i === 14;
          return (
            <g key={d}>
              <line
                x1={x}
                y1={headH - 20}
                x2={x}
                y2={chartH - 26}
                stroke={isWeekBreak ? theme.stroke.primary : theme.stroke.tertiary}
                strokeWidth={isWeekBreak ? 1.2 : 0.5}
              />
              <text
                x={x + 2}
                y={headH - 26}
                fill={theme.text.tertiary}
                fontSize={9}
              >
                {d}
              </text>
            </g>
          );
        })}

        {[
          { i: 0, label: "W1 데이터·정적기반" },
          { i: 7, label: "W2 기상·라벨·모델" },
          { i: 14, label: "W3 동선·통합·시연" },
        ].map((w) => (
          <text
            key={w.label}
            x={labelW + w.i * dayW + 4}
            y={14}
            fill={theme.accent.primary}
            fontSize={10}
            fontWeight={600}
          >
            {w.label}
          </text>
        ))}

        {MILESTONES.map((m) => {
          const x = labelW + m.day * dayW;
          return (
            <g key={m.code}>
              <line
                x1={x}
                y1={headH - 20}
                x2={x}
                y2={chartH - 26}
                stroke={theme.diff.stripRemoved}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={x + 3}
                y={chartH - 14}
                fill={theme.diff.stripRemoved}
                fontSize={9}
                fontWeight={600}
              >
                {m.code}
              </text>
              <text x={x + 3} y={chartH - 4} fill={theme.text.tertiary} fontSize={8}>
                {m.label}
              </text>
            </g>
          );
        })}

        {rendered}

        <line
          x1={labelW}
          y1={headH - 20}
          x2={labelW}
          y2={chartH - 26}
          stroke={theme.stroke.primary}
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

function DependencyDiagram() {
  const theme = useHostTheme();
  const w = 780;
  const h = 200;
  const crit = theme.diff.stripRemoved;

  const chain = [
    { x: 10, label: "D1\n산불이력" },
    { x: 118, label: "P6\n라벨링" },
    { x: 226, label: "M2\n학습" },
    { x: 334, label: "M4\n5등급" },
    { x: 442, label: "B2\n위험API" },
    { x: 550, label: "R4\nOR-Tools" },
    { x: 658, label: "A3\n동선표출" },
  ];

  const parallel = [
    { x: 10, label: "D3 공간데이터" },
    { x: 160, label: "P1 정적피처" },
    { x: 310, label: "R1 이동그래프" },
    { x: 460, label: "B1 PostGIS" },
    { x: 610, label: "A1 더미제거" },
  ];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="크리티컬 패스와 병렬 트랙 의존 관계">
      <rect x={0} y={0} width={w} height={h} fill={theme.bg.editor} />

      <text x={10} y={16} fill={crit} fontSize={11} fontWeight={600}>
        크리티컬 패스 — 하나라도 밀리면 발표가 밀린다
      </text>
      {chain.map((n, i) => (
        <g key={n.label}>
          <rect
            x={n.x}
            y={28}
            width={92}
            height={44}
            fill={theme.fill.secondary}
            stroke={crit}
            strokeWidth={1.2}
            rx={3}
          />
          {n.label.split("\n").map((line, li) => (
            <text
              key={line}
              x={n.x + 46}
              y={46 + li * 13}
              fill={theme.text.primary}
              fontSize={10}
              textAnchor="middle"
            >
              {line}
            </text>
          ))}
          {i < chain.length - 1 && (
            <text x={n.x + 100} y={54} fill={crit} fontSize={13}>
              →
            </text>
          )}
        </g>
      ))}

      <text x={10} y={104} fill={theme.text.secondary} fontSize={11} fontWeight={600}>
        병렬 트랙 — D1 결과와 무관하게 Day 1부터 착수 (대기 인원 금지)
      </text>
      {parallel.map((n) => (
        <g key={n.label}>
          <rect
            x={n.x}
            y={116}
            width={134}
            height={30}
            fill={theme.fill.tertiary}
            stroke={theme.stroke.secondary}
            strokeWidth={1}
            rx={3}
          />
          <text x={n.x + 67} y={135} fill={theme.text.secondary} fontSize={10} textAnchor="middle">
            {n.label}
          </text>
        </g>
      ))}

      <text x={10} y={172} fill={theme.text.tertiary} fontSize={10}>
        D1(산불 이력)이 유일한 진짜 차단 요인이다. Day 2 G1에서 실패하면 즉시 M7 폴백(R = S^α × W^β)으로 전환한다.
      </text>
      <text x={10} y={188} fill={theme.text.quaternary} fontSize={9}>
        출처: docs/PROJECT_PLAN_3WEEK.md · 4장 선행 관계
      </text>
    </svg>
  );
}

function DiagnosisTab() {
  const theme = useHostTheme();
  return (
    <Stack gap={16}>
      <Callout tone="danger" title="한 줄 진단">
        중간발표가 깨진 원인은 기술력이 아니라 <Text weight="semibold">설계 문서와 실제 산출물의 격차</Text>다.
        설계서에는 1,553셀·24컴포넌트·0.2초 같은 실측 수치가 가득한데, 돌아가는 시스템에는 그중 아무것도 들어가 있지 않다.
      </Callout>

      <Callout tone="warning" title="짝 프로그래밍 검수 (0.3) — 사용자가 말 안 해도 Must">
        <Text size="small">
          D1 공간정밀도 · 폐루프 시연(O5) · assignment_id(B11) · 근무자·거점(R11) · 위험 신선도(A12) ·
          피처패리티(M8) · 카카오 도메인(O6) · EC2 서빙(O7) · 시연 시드(O8) · 순찰유형 Must(R5) · 배정 멱등(B3).
          말하니까 추가하는 Must가 아니라, 빠지면 중간발표가 반복되는 구멍이다.
        </Text>
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value="0건" label="산불 이력 (학습 불가)" tone="danger" />
        <Stat value="0개" label="로컬 원본 공간데이터" tone="danger" />
        <Stat value="10개" label="동작하는 API 엔드포인트" tone="success" />
        <Stat value="21일" label="발표까지 남은 기간" tone="warning" />
      </Grid>

      <H2>있는 것 — 검증된 자산</H2>
      <Table
        headers={["자산", "상태", "근거"]}
        rows={[
          ["src/grid.py", "동작 검증 완료", "국가지점번호 500m 인코딩, 왕복 오차 0m"],
          ["analysis 8개 스크립트", "로직 완성", "단 원본 데이터가 없어 재실행 불가"],
          ["FastAPI 백엔드", "EC2 운영 중", "인증(JWT)·프로필·순찰보고서 10개 엔드포인트"],
          ["프론트 8페이지", "동작", "로그인·지도·순찰·보고서·마이페이지"],
          ["Capacitor Android", "빌드·설치 성공", "JDK 21 필요, 에뮬레이터 배포 확인"],
          ["설계 문서 3종", "수치 근거 충실", "심사 방어 논리의 핵심 자산"],
        ]}
        rowTone={["success", "warning", "success", "success", "success", "success"]}
      />

      <H2>없는 것 — 치명적 결손</H2>
      <Table
        headers={["결손", "현재", "영향"]}
        rows={[
          ["산불 이력 데이터", "0건", "지도학습 자체가 불가능. 최우선 차단 요인"],
          ["기상 관측 이력", "없음", "동적 피처 전부 불가"],
          ["원본 공간데이터", "data/에 README만", "243MB gitignore. 분석 재현 불가"],
          ["인적 위험 피처", "설계에도 없음", "모델 타당성의 근본 결함"],
          ["화성 4구 경계", "없음", "구별 위험도 표출 불가"],
          ["위험도 / 동선 API", "없음", "모델과 앱이 연결 안 됨"],
          ["요원 GPS 수집", "없음", "실시간·피드백 기능 전체의 전제"],
        ]}
        rowTone={["danger", "danger", "danger", "danger", "warning", "warning", "warning"]}
      />

      <H2>앱에서 진짜인 것 vs 가짜인 것</H2>
      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader trailing={<Pill size="sm" tone="success">real</Pill>}>진짜로 동작</CardHeader>
          <CardBody>
            <Stack gap={4}>
              {[
                "회원가입 · 로그인 · 세션(JWT)",
                "프로필 · 비밀번호 변경",
                "순찰보고서 등록 · 조회",
                "내 GPS (index 페이지)",
                "OSRM 도보 경로 (1구간만)",
                "카카오맵 타일",
              ].map((s) => (
                <Text key={s} size="small" tone="secondary">{s}</Text>
              ))}
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm" tone="deleted">dummy</Pill>}>더미 · 하드코딩</CardHeader>
          <CardBody>
            <Stack gap={4}>
              {[
                "위험구역 5개 (dummyDangerZones)",
                "팀원 위치 4명 (고정 좌표)",
                "\"최적 순찰 경로\" = DZ_001→SO_001~017→DZ_003 고정",
                "경유지 17개 직선 연결 (도로 스냅 없음)",
                "순찰 페이지 GPS 추적 (미구현)",
                "보고서 미니맵 경로 (빈 지도)",
                "알림 4건 (정적 HTML)",
              ].map((s) => (
                <Text key={s} size="small" tone="secondary">{s}</Text>
              ))}
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Text tone="tertiary" size="small" style={{ color: theme.text.tertiary }}>
        요약: 인증과 보고서만 진짜다. 산불·위험도·동선은 전부 데모용 껍데기다.
      </Text>
    </Stack>
  );
}

function GoalTab() {
  const theme = useHostTheme();
  return (
    <Stack gap={16}>
      <H2>브레인스토밍 10단계 → 3주 처리</H2>
      <Table
        headers={["#", "아이디어", "3주", "계획 ID"]}
        rows={[
          ["1", "산불 이력", "Must · Day1~2 결판", "D1, G1"],
          ["2", "기상이력 + 음성표본", "Must", "D2, P2~P6"],
          ["3", "경사·임상 공간데이터", "Must (로컬 재확보)", "D3, P1"],
          ["4", "조인·전처리", "Must", "P1~P7"],
          ["5", "모델 · \"기상으로 확률?\"", "프레이밍 수정 → 상대순위", "M1~M7, D5"],
          ["6", "위험등급 → 동선", "Must (동일 grid_id)", "M4, B2, R2~R4"],
          ["7", "진입/근접/원거리", "Should", "R5"],
          ["8", "실시간·민원·루트학습", "쪼갬: 플래그Must / 온라인Won't", "F1,B8,B9 / #41"],
          ["9", "TOP + OR-Tools", "Must", "R1~R6"],
          ["10", "완벽한 앱", "실API+체크리스트 Must", "A1~A3,A8"],
        ]}
        columnAlign={["center", "left", "left", "left"]}
        rowTone={[
          "danger", "danger", "danger", undefined, "danger",
          "danger", undefined, "warning", "danger", "warning",
        ]}
      />

      <Callout tone="danger" title="질문에 대한 답: 그 프레이밍은 틀렸다">
        <Text>
          "기상청 데이터로 산불 확률을 맞추고 그 수치를 끌어올린다"는 목표는 3주가 아니라 3년을 줘도 달성 못 한다.
        </Text>
      </Callout>

      <H2>왜 틀렸는가 — 세 가지 이유</H2>
      <Grid columns={3} gap={12}>
        <Card>
          <CardHeader>1. 극단적 클래스 불균형</CardHeader>
          <CardBody>
            <Text size="small">
              화성시 연간 산불은 한 자릿수~십몇 건. 학습 행렬은 1,553셀 × 8,760시간 = <Code>1,360만 행</Code>.
              양성 비율 10⁻⁶에서 "확률 추정"은 성립하지 않는다. 전부 0으로 찍으면 정확도 99.9999%가 나온다.
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>2. 인과 구조 불일치</CardHeader>
          <CardBody>
            <Text size="small">
              기상은 <Text weight="semibold">연료가 탈 준비가 되었는가</Text>만 설명한다.
              국내 발화원의 대부분은 인간 활동(입산자 실화·논밭두렁 소각·담뱃불)이다.
              건조한 날은 전 지역이 똑같이 건조하므로 기상만으로는 격자 간 변별이 안 된다.
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>3. 평가지표 왜곡</CardHeader>
          <CardBody>
            <Text size="small">
              불균형 데이터에서 accuracy와 ROC-AUC는 무의미하다.
              심사에서 "정확도 몇 %냐"에 그 숫자로 답하는 순간 끝난다.
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <H2>옳은 프레이밍</H2>
      <Callout tone="success" title="목표 재정의">
        <Text>
          절대 확률이 아니라 <Text weight="semibold">상대 위험 순위</Text>를 산출하고,
          그 순위가 <Text weight="semibold">한정된 순찰 자원 배분을 개선하는가</Text>로 평가한다.
        </Text>
      </Callout>

      <Card>
        <CardHeader>발표에서 쓸 문장</CardHeader>
        <CardBody>
          <Stack gap={6}>
            <Text weight="semibold" style={{ color: theme.accent.primary }}>
              상위 10% 격자를 순찰하면 실제 산불 발생의 X%를 커버한다. 무작위 순찰 대비 Y배다.
            </Text>
            <Text size="small" tone="secondary">
              감시원 인력은 정해져 있고, 우리는 그 인력을 어디에 보낼지를 개선한다.
              이 프레이밍은 모델이 완벽하지 않아도 가치가 성립한다.
            </Text>
          </Stack>
        </CardBody>
      </Card>

      <H2>입력은 3층이어야 한다 — 현재 설계의 최대 구멍</H2>
      <Grid columns={3} gap={12}>
        <Card>
          <CardHeader trailing={<Pill size="sm">연 1회</Pill>}>정적 취약도 S(x)</CardHeader>
          <CardBody>
            <Text size="small">임상 · 경사 · 사면방위 · 연료량</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm">1시간</Pill>}>동적 기상 W(t)</CardHeader>
          <CardBody>
            <Text size="small">FWI · 실효습도 · VPD · 풍속</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm" tone="deleted">미설계</Pill>}>인적 노출 H(x,t)</CardHeader>
          <CardBody>
            <Text size="small">민원 · 인구 · 도로접근 · 농경지 · 주말</Text>
          </CardBody>
        </Card>
      </Grid>
      <Text size="small" tone="secondary">
        H(x,t)가 없으면 모델은 "산이면 위험하다"밖에 못 배운다.
        인적 노출 피처는 선택이 아니라 <Text weight="semibold">모델 타당성의 필수 조건</Text>이다. (요구사항 D5)
      </Text>

      <H2>평가 지표 확정</H2>
      <Table
        headers={["지표", "왜 쓰는가", "목표"]}
        rows={[
          ["Capture rate @ top 10%", "상위 10% 격자가 실제 발생의 몇 %를 담는가 (주력)", "≥ 50%"],
          ["Lift @ top 10%", "무작위 대비 몇 배 효율", "≥ 3배"],
          ["PR-AUC", "불균형에서 유효한 요약 지표", "베이스라인 초과"],
          ["Brier / 캘리브레이션", "등급이 실제 빈도와 맞는가", "단조 증가"],
          ["ROC-AUC", "관례상 병기하되 주력으로 쓰지 않음", "참고"],
          ["accuracy", "사용 금지", "—"],
        ]}
        rowTone={["success", "success", undefined, undefined, "warning", "danger"]}
      />

      <H2>반드시 이겨야 하는 베이스라인</H2>
      <Table
        headers={["코드", "내용", "의미"]}
        rows={[
          ["B0", "무작위 격자 선택", "최소 기준"],
          ["B1", "정적 단독 (conifer_ratio + 경사 + 산림비율)", "공간 정보만의 기여"],
          ["B2", "FWI 단독 (산림청/기상청 공식 지수)", "이걸 못 이기면 프로젝트 명분이 없다"],
        ]}
        rowTone={[undefined, undefined, "danger"]}
      />
    </Stack>
  );
}

function RequirementsTab() {
  return (
    <Stack gap={16}>
      <Callout tone="warning" title="2026-08-06 추가 검증 — 3건">
        <Text size="small">
          정형 플래그 보고서=Must · 암묵 공유(오버레이)=Should · 관측소 15km=Must(동네예보+uncertainty).
          수기 보고서·메신저·단일ASOS 전역복제는 Won't.
        </Text>
      </Callout>

      <Text tone="secondary">
        우선순위는 <Code>M</Code>(Must) / <Code>S</Code>(Should) / <Code>C</Code>(Could) / <Code>W</Code>(Won't).
      </Text>

      <H2>데이터 확보 (D)</H2>
      <Table
        headers={["ID", "요구사항", "우선", "수용 기준"]}
        rows={[
          ["D1", "산불 이력 확보", "M", "발생일시·좌표·원인 포함, 전국 5년 이상 / 최소 3,000건"],
          ["D2", "기상 관측 이력", "M", "D1 기간 커버, 시간 단위, 경기권 ASOS/AWS"],
          ["D3", "공간데이터 재확보", "M", "임상도·입지토양도·등산로·임도망도"],
          ["D5", "인적 노출 대리변수", "M", "격자 매핑 가능한 인구·건물·도로·농경지 중 최소 2종"],
          ["D4", "화성 4구 행정경계", "S", "만세·효행·병점·동탄 폴리곤 EPSG:5179"],
          ["D6", "OSM 도로망", "S", "화성 extent+5km 차량 통행 도로"],
          ["D7", "실시간 기상 API", "S", "초단기실황·단기예보 인증키"],
          ["D8", "민원 데이터", "C", "종류·주소정밀도·접수일시 3개 모두 충족 시에만"],
        ]}
        columnAlign={["left", "left", "center", "left"]}
        rowTone={["danger", "danger", "danger", "danger", undefined, undefined, undefined, undefined]}
      />

      <H2>전처리 (P) · 모델 (M)</H2>
      <Table
        headers={["ID", "요구사항", "우선", "수용 기준"]}
        rows={[
          ["P1", "500m 격자 + 정적 피처", "M", "학습 대상 1,553셀, grid_static 적재"],
          ["P2", "기상 원본 정제", "M", "-99 센티널 → NaN, 물리 범위 검증"],
          ["P3", "기상 파생변수", "M", "VPD·실효습도·dry_hours·wind_u/v·FFMC/ISI/FWI"],
          ["P4", "시공간 조인 (동네예보 1순위)", "M", "단일 ASOS 전역복제 금지"],
          ["P5", "인적 노출 격자화", "M", "인구·도로·농경지 최소 2종"],
          ["P6", "라벨링 + 음성 샘플링", "M", "양성:음성 1:20, 시공간 매칭"],
          ["P7", "누출 감사", "M", "결과변수·미래정보 제외"],
          ["P8", "기상 불확실성 피처", "M", "dist_station / wx_uncertainty"],
        ]}
        columnAlign={["left", "left", "center", "left"]}
        rowTone={[
          undefined, undefined, undefined, "danger", undefined,
          "danger", "danger", "danger",
        ]}
      />

      <H2>정형 플래그 · 암묵 공유 (F/A/B) ★추가</H2>
      <Table
        headers={["ID", "요구사항", "우선", "수용 기준"]}
        rows={[
          ["F1", "위험 플래그 택소노미 v1", "M", "코드·가산·half-life 동결"],
          ["A8", "체크리스트 보고서 UI", "M", "textarea 보조, grid_id 필수"],
          ["B8", "정형 관측 API·스키마", "M", "patrol_observations + assignment_id"],
          ["B9", "플래그 규칙 가산 엔진", "M", "즉시가산 + half-life"],
          ["B11", "배정 엔티티", "M", "planned_grid_ids + risk_computed_at"],
          ["B12", "근무자·거점 API", "M", "on-duty + depot + role"],
          ["A9", "동료 플래그 지도 오버레이", "S", "공유 버튼 없음"],
          ["A10", "인근 플래그 알림", "S", "메신저 아님"],
          ["A12", "위험 신선도 UI", "M", "computed_at / stale 경고"],
          ["R10", "불확실성→TOP 페널티 감쇠", "S", "플래그 가산은 감쇠 면제"],
          ["R11", "당일 근무자·출발 거점", "M", "하드코딩 5명 금지"],
        ]}
        columnAlign={["left", "left", "center", "left"]}
        rowTone={["danger", "danger", "danger", "danger", "danger", "danger", undefined, undefined, "danger", undefined, "danger"]}
      />

      <H2>짝프 검수 Must (O5~O8 등)</H2>
      <Table
        headers={["ID", "요구사항", "우선", "수용 기준"]}
        rows={[
          ["O5", "폐루프 시연 스크립트", "M", "위험→배정→플래그→지도갱신"],
          ["O6", "카카오 Capacitor 도메인", "M", "에뮬 지도 스모크"],
          ["O7", "EC2에서 배정·위험 서빙", "M", "노트북-only 금지"],
          ["O8", "시연 시드 데이터", "M", "위험+플래그+요원 시나리오"],
          ["M8", "피처 패리티 파일", "M", "feature_list.json assert"],
          ["M9", "평가 지리 프로토콜", "M", "학습/평가 지역 1페이지"],
          ["R5", "순찰유형 3단계", "M", "미분류 0건 (격상)"],
          ["D1", "산불이력+공간정밀도", "M", "시군만이면 G1 실패"],
        ]}
        columnAlign={["left", "left", "center", "left"]}
        rowTone={["danger", "danger", "danger", "danger", "danger", "warning", "danger", "danger"]}
      />

      <H2>전처리 계속 · 모델 (M)</H2>
      <Table
        headers={["ID", "요구사항", "우선", "수용 기준"]}
        rows={[
          ["M1", "베이스라인 3종", "M", "B0/B1/B2 지표 산출"],
          ["M2", "LightGBM 주모델", "M", "학습·추론 재현 스크립트"],
          ["M3", "공간블록 + 시간격리 CV", "M", "무작위 CV 금지"],
          ["M4", "캘리브레이션 + 5등급", "M", "Isotonic, 단조 증가"],
          ["M5", "평가 리포트", "M", "Capture@10% ≥ 50%, Lift ≥ 3"],
          ["M6", "SHAP 설명", "S", "심사 질의 대응"],
          ["M7", "폴백 R = S^α × W^β", "M", "D1 실패 시 즉시"],
        ]}
        columnAlign={["left", "left", "center", "left"]}
        rowTone={[undefined, "danger", "warning", "danger", "danger", undefined, "warning"]}
      />

      <H2>동선 최적화 (R)</H2>
      <Table
        headers={["ID", "요구사항", "우선", "수용 기준"]}
        rows={[
          ["R1", "이동 그래프 구축", "M", "간선 가중치 분 단위"],
          ["R2", "격자 → 방문노드 스냅", "M", "접근 가능 지점"],
          ["R3", "이동시간 행렬", "M", "도보/차량 2계층"],
          ["R4", "OR-Tools TOP 솔버", "M", "180분·2초 내"],
          ["R5", "순찰 유형 3단계", "S", "진입/근접/원거리"],
          ["R6", "GeoJSON 출력", "M", "경로+순서+국가지점번호"],
          ["R7", "복귀 비용 포함", "S", "하산점까지 계상"],
          ["R8", "재방문 감점", "S", "최근 n일"],
          ["R9", "형평성 가중", "C", "장기 미방문"],
        ]}
        columnAlign={["left", "left", "center", "left"]}
      />

      <H2>백엔드 · 앱 · 운영 (핵심만)</H2>
      <Table
        headers={["ID", "요구사항", "우선", "수용 기준"]}
        rows={[
          ["B1", "PostGIS + observations", "M", "spatial + patrol_observations"],
          ["B2", "GET /risk/grids", "M", "< 1초, uncertainty 포함"],
          ["B3", "POST /patrol/assign", "M", "배정 GeoJSON"],
          ["A1", "dummyData 제거", "M", "실 API 대체"],
          ["A2", "위험 격자 지도", "M", "5등급"],
          ["A3", "배정 동선 표출", "M", "유형 뱃지"],
          ["A5", "보고서 grid_id 스냅", "M", "A8 전제"],
          ["O1", "재현 파이프라인", "M", "run_pipeline.py"],
          ["O2", "시연 폴백 스냅샷", "M", "API 장애 대비"],
          ["O3", "한계 슬라이드", "M", "기상보간·플래그표본"],
        ]}
        columnAlign={["left", "left", "center", "left"]}
      />

      <H2>명시적 제외 (Won't)</H2>
      <Table
        headers={["제외 항목", "이유"]}
        rows={[
          ["딥러닝 / RL 동선", "표본·기간 부족"],
          ["실시간 온라인 재학습", "선택편향. 규칙가산+배치재학습"],
          ["보고서 NLP / LLM", "체크리스트로 해결"],
          ["감시원 메신저·SNS", "격자 오버레이로 충분"],
          ["단일 ASOS 전역 복제", "방법론 금지 (P4/P8)"],
          ["3구간 실측 / 드론 / iOS", "현장·하드웨어·장비 없음"],
        ]}
      />
    </Stack>
  );
}

function GanttTab() {
  const theme = useHostTheme();
  return (
    <Stack gap={16}>
      <Row gap={16} align="center" wrap>
        <Row gap={6} align="center">
          <div style={{ width: 20, height: 9, background: theme.diff.stripRemoved, borderRadius: 2 }} />
          <Text size="small" tone="secondary">크리티컬 패스</Text>
        </Row>
        <Row gap={6} align="center">
          <div style={{ width: 20, height: 9, background: theme.accent.primary, opacity: 0.55, borderRadius: 2 }} />
          <Text size="small" tone="secondary">일반 작업</Text>
        </Row>
        <Row gap={6} align="center">
          <div style={{ width: 1, height: 14, background: theme.diff.stripRemoved }} />
          <Text size="small" tone="secondary">게이트 (판단 시점)</Text>
        </Row>
      </Row>

      <GanttChart />

      <Text size="small" tone="tertiary">
        기간: 2026-08-06(목) ~ 08-27(목) · 22일 · 트랙 6개 · 작업 42개 · 출처: docs/PROJECT_PLAN_3WEEK.md
      </Text>

      <Divider />

      <H2>선행 관계</H2>
      <DependencyDiagram />

      <H2>주차별 종료 조건</H2>
      <Table
        headers={["주차", "기간", "주제", "종료 조건"]}
        rows={[
          ["W1", "08/06 ~ 08/12", "데이터 확보 + 정적 기반 + 폴백 확정", "G1 · G2 통과"],
          ["W2", "08/13 ~ 08/19", "기상 · 라벨 · 모델 + API 골격", "G3 통과"],
          ["W3", "08/20 ~ 08/26", "동선 + 앱 통합 + 시연 안정화", "G4 · G5 통과"],
          ["발표", "08/27", "최종 발표", "—"],
        ]}
      />

      <H2>역할 분담 (5인 기준)</H2>
      <Table
        headers={["역할", "담당 요구사항", "비고"]}
        rows={[
          ["데이터", "D1~D8, P2, P4", "Day1~2 D1에 총력. 확보 후 기상 담당"],
          ["모델", "P1, P5, P6, P7, M1~M7", "가장 부하 큼. G3가 이 사람 책임"],
          ["동선", "R1~R9", "D1과 독립이라 Day1부터 풀가동"],
          ["백엔드", "B1~B7, O1", "PostGIS · API · 배포"],
          ["앱", "A1~A7, O2, O4", "Day1부터 더미 제거 착수"],
        ]}
      />
      <Callout tone="warning">
        D1이 막히는 Day 1~2에는 데이터 담당 외 <Text weight="semibold">전원이 병렬 트랙(R1·P1·A1·B1)에 붙는다.</Text> 대기 금지.
      </Callout>
    </Stack>
  );
}

function GatesTab() {
  return (
    <Stack gap={16}>
      <Text tone="secondary">
        게이트는 "잘 되고 있나 확인하는 자리"가 아니라 <Text weight="semibold">분기를 확정하는 자리</Text>다.
        기준 미달이면 그 자리에서 폴백으로 전환하고 되돌아보지 않는다.
      </Text>

      <Table
        headers={["게이트", "시점", "판단 기준", "통과 실패 시"]}
        rows={[
          ["G1", "Day 2 · 08/07", "산불 3,000건 + 좌표/읍면동 정밀도", "정밀도 실패도 즉시 M7"],
          ["G2", "Day 7 · 08/12", "정적 1,553셀 + 기상 파서", "인적노출 축소 / 동네예보"],
          ["G3", "Day 12 · 08/17", "B2(FWI) 승리 또는 M7 확정", "지수 설계로 프레임 변경"],
          ["G4", "Day 17 · 08/22", "실API + 플래그 1건 가산", "O2+O8 스냅샷 시연"],
          ["G5", "Day 19 · 08/24", "O5 폐루프 + O6/O7 스모크", "기능 동결·안정화만"],
        ]}
        rowTone={["danger", "warning", "danger", "warning", "warning"]}
      />

      <H2>폴백 전략 (D1 실패 시) — 설계된 분기이지 실패가 아니다</H2>
      <Card>
        <CardHeader>M7 규칙 기반 위험지수</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Code>{`R(x,t) = S(x)^α × W(t)^β

S(x) = 정규화(conifer_ratio, 경사, 남향 가중, forest_ratio, 인적노출)
W(t) = 정규화(FWI 또는 실효습도·VPD·풍속)
α, β = 문헌값 또는 전문가 가중 (예: α=0.6, β=0.4)`}</Code>
            <Divider />
            <H3>이때 발표 논리</H3>
            <Text size="small">
              산불 이력의 공간 정밀도가 격자 단위 학습에 못 미쳐, 지도학습 대신
              <Text weight="semibold"> 산림청 공식 지수(FWI/실효습도)에 화성 고유의 정적 취약도를 결합한 위험지수</Text>를 설계했다.
              검증은 과거 산불 발생 읍면동과의 순위 일치도로 대체한다.
            </Text>
            <Callout tone="success">
              이 경로에서도 동선 최적화(R)와 앱 통합(A)은 그대로 살아 있다. 시스템의 완결성은 유지된다.
            </Callout>
          </Stack>
        </CardBody>
      </Card>

      <H2>리스크 레지스터</H2>
      <Table
        headers={["리스크", "확률", "영향", "대응"]}
        rows={[
          ["산불 이력 미확보 / 저정밀", "높음", "치명", "G1에서 즉시 M7 폴백. 발표 프레임 전환"],
          ["모델이 FWI를 못 이김", "중", "큼", "G3에서 판단. 인적 노출 강화 → 안 되면 M7"],
          ["기상 이력이 일 단위뿐", "중", "큼", "목표를 일별 위험도로 하향, 시나리오 변경"],
          ["인적 노출 격자 매핑 실패", "중", "큼", "건물밀도·도로거리 대체 지표로 축소"],
          ["앱-API 통합 지연", "중", "큼", "G4에서 정적 스냅샷 시연으로 전환"],
          ["OSM 도로망 품질 문제", "중", "중", "직선×1.4 추정 유지, 한계 명시"],
          ["EC2 리소스 부족", "낮", "중", "추론 결과 사전 계산해 적재. 실시간 추론 회피"],
        ]}
        columnAlign={["left", "center", "center", "left"]}
        rowTone={["danger", "danger", "warning", "warning", "warning", undefined, undefined]}
      />

      <H2>발표 방어 논리 — 예상 질문과 답변</H2>
      <Table
        headers={["예상 질문", "답변"]}
        rows={[
          [
            "정확도가 몇 %인가?",
            "정확도는 이 문제에서 무의미합니다. 산불은 극단적 희귀 사건이라 전부 '없음'으로 예측해도 99.99%가 나옵니다. 저희는 상위 10% 격자가 실제 발생의 몇 %를 포착하는가(capture rate)와 무작위 대비 배수(lift)로 평가합니다.",
          ],
          [
            "기상만으로 산불을 예측할 수 있나?",
            "없습니다. 기상은 연료가 탈 준비가 되었는가만 설명하고, 발화원의 대부분은 인간 활동입니다. 그래서 정적 취약도 × 동적 기상 × 인적 노출의 3층 구조로 설계했습니다.",
          ],
          [
            "기존 산림청 지수와 뭐가 다른가?",
            "기존 지수는 시·군 단위입니다. 저희는 500m 격자이고, 무엇보다 위험도 격자 ID를 순찰 배정에 그대로 넘겨 의사결정까지 연결합니다.",
          ],
          [
            "동선이 진짜 최적인가?",
            "Team Orienteering Problem으로 정식화해 OR-Tools로 풉니다. 이동비용은 직선거리가 아니라 산림청 등산로 실측 상행·하행 소요시간(201구간 결측 0%)입니다. 요원 5명 × 격자 20개 배정이 0.2초입니다.",
          ],
          [
            "왜 500m인가?",
            "국가지점번호 기준점이 500의 배수라 경계가 정확히 맞고, 등산로 표지판과 같은 ID 체계라 현장에서 통용됩니다. 대가는 셀 내부 이질성이고, 그래서 범주형을 전부 면적 비율로 전환했습니다.",
          ],
          [
            "안 되는 건 뭔가?",
            "세 가지입니다. 등산로 종점에서 격자 내부까지 마지막 도보 구간은 추정치입니다. 산 간 차량 도로망이 아직 근사입니다. 요원 GPS 피드백 학습은 설계만 되어 있고 데이터가 쌓여야 작동합니다.",
          ],
          [
            "쓸수록 좋아지나?",
            "네. 요원 GPS 트레이스로 간선 소요시간을 보정하고, 반복 통과 경로를 비공식 등산로로 그래프에 추가합니다. 다만 순찰 간 곳만 데이터가 쌓이는 선택 편향이 있어 배정의 일부를 의도적 탐색에 할당하는 설계를 넣었습니다.",
          ],
        ]}
      />
    </Stack>
  );
}

function DetailsTab() {
  return (
    <Stack gap={16}>
      <Text tone="secondary">
        발표에서 질문받거나, 안 챙기면 나중에 무너지는 항목들이다. 총 46개.
      </Text>

      <H2>라벨 · 시간 정합성 — 가장 많이 터지는 곳</H2>
      <Table
        headers={["#", "항목", "왜 위험한가", "처리"]}
        rows={[
          ["1", "시간대 혼재", "산불 KST vs 기상 UTC. 1시간 어긋나면 라벨 전체 오염", "모든 시각 tz-aware KST 고정"],
          ["2", "발생시각 vs 신고시각", "데이터는 대개 신고 시각. 실제 발화는 앞섬", "라벨 시각을 신고 −1h~−3h 윈도우로 정의"],
          ["3", "주간 편향", "신고는 목격자 있는 낮에 몰림. 야간 과소 기록", "hour 피처가 편향 학습함을 인지, 시간대 층화"],
          ["4", "동일 화재 다격자", "한 화재가 여러 격자에 걸침 → 양성 중복", "event_id로 그룹화, CV split을 화재 단위로"],
          ["5", "정적 피처 시점", "2020년 산불에 2024년 임상도 = 미묘한 누출", "한계 명시, 가능하면 연도 맞춤"],
          ["6", "미래정보 누출", "rolling 계산에 미래 시점 포함", "closed='left', 과거만"],
          ["7", "결과변수 누출", "진화시간·피해면적·투입인력은 결과", "피처에서 물리적 제외 (P7 감사)"],
        ]}
        columnAlign={["center", "left", "left", "left"]}
        rowTone={["danger", "danger", "warning", "danger", "warning", "danger", "danger"]}
      />

      <H2>데이터 함정</H2>
      <Table
        headers={["#", "항목", "처리"]}
        rows={[
          ["8", "-99.0 센티널 (습도 10%, 기압·강수 일부)", "→ NaN. 0으로 채우면 학습이 뒤집힘"],
          ["9", "RN_DAY 일 누적값", "시간 차분 + 자정 리셋"],
          ["10", "풍향 원형변수 (359°와 1°의 평균이 180°)", "u = -WS·sin(WD), v = -WS·cos(WD)"],
          ["11", "강수 결측을 0으로 채우기", "\"비 안 온 건조한 시각\"으로 역전. NaN 유지"],
          ["12", "ARA_XCRD/YCRD는 EPSG:5181", "geometry(5179)에서만 좌표 추출. 100km 오차"],
          ["13", "shapefile 인코딩 cp949", "gpd.read_file(path, encoding=\"cp949\")"],
          ["14", "EIGHT_AGL은 8방위 코드가 아님", "연속 각도. -1(평탄지 1.7%) → NaN 후 sin/cos"],
          ["15", "500m 셀에서 범주형 최빈값 무의미", "최빈 수종 점유율 중앙 50.6%. 면적 비율로만"],
          ["16", "관측소 이설·장기 결측", "지점 이력 확인, 결측 구간 리포트"],
          ["17", "화성 ASOS 0개 (수원 12.4km)", "IDW보다 동네예보 5km 격자가 안전"],
        ]}
        columnAlign={["center", "left", "left"]}
      />

      <H2>모델 검증</H2>
      <Table
        headers={["#", "항목", "처리"]}
        rows={[
          ["18", "공간 자기상관", "무작위 CV는 인접 격자가 갈려 성능 과대평가. 공간 블록 CV 필수"],
          ["19", "시간 누출", "최근 1년 반드시 홀드아웃"],
          ["20", "음성 표본 분포", "양성이 봄·주말·오후에 몰리면 음성도 같은 분포에서. 아니면 \"봄이면 불난다\"만 학습"],
          ["21", "등급 안정성", "분위수 기준이 매시간 바뀌면 등급 요동. 기준 분포를 고정 기간으로 산출"],
          ["22", "캘리브레이션 단조성", "1~5등급의 실제 발생 빈도가 단조 증가하는지 확인"],
          ["23", "모델 버전 기록", "어떤 모델이 어떤 등급을 냈는지 저장 (사후 검증)"],
        ]}
        columnAlign={["center", "left", "left"]}
        rowTone={["danger", "danger", "danger", "warning", undefined, undefined]}
      />

      <H2>동선 · 현장 운영</H2>
      <Table
        headers={["#", "항목", "왜 중요한가", "처리"]}
        rows={[
          ["24", "격자 중심 ≠ 갈 수 있는 지점", "중심점이 절벽일 수 있음", "접근 가능 노드로 스냅 (R2)"],
          ["25", "복귀 비용 누락", "요원이 산속에 남는 해가 나옴", "출발지 회귀 또는 하산점까지 계상"],
          ["26", "휴게·점심 미반영", "180분 연속 근무는 비현실적", "근무시간 상한에 휴게 반영"],
          ["27", "일몰 시각", "야간 산행 금지 → 계절별 배정 상한 상이", "일몰 −1시간을 상한으로"],
          ["28", "요원 차량 유무", "차 없는 요원에게 산 간 이동 배정 불가", "요원 속성으로 제약 선언"],
          ["29", "연속일 중복 방문", "위험도만 보면 매일 같은 곳만 감", "최근 n일 방문 감점 (R8)"],
          ["30", "커버리지 형평성", "저위험 구역은 영원히 미방문", "미방문 일수 가산 (R9)"],
          ["31", "GPS 정확도", "산림에서 오차 큼", "방문 판정 반경 100m + 체류시간 조건"],
          ["32", "오프라인", "산에서 통신 끊김", "경로 사전 캐시, 로컬 로그 후 동기화 (A7)"],
          ["33", "배터리", "연속 GPS 소모 큼", "정지 시 샘플링 간격 확대"],
          ["34", "재배정 폭주", "경보마다 재계산하면 현장 혼란", "히스테리시스 + 최소 유지시간 30분"],
          ["35", "미방문 사유 로그", "\"왜 이 격자를 안 갔나\" 설명 필요", "페널티·잔여시간 로그 저장"],
        ]}
        columnAlign={["center", "left", "left", "left"]}
      />

      <H2>피드백 루프 — "쓸수록 좋아지나?"의 답</H2>
      <Table
        headers={["#", "항목", "설계"]}
        rows={[
          [
            "36",
            "실주행 vs 배정 경로 편차 학습",
            "GPS 트레이스로 구간별 실제 소요시간 수집 → 간선 가중치를 지수이동평균으로 보정. 문서에 남은 \"3구간 추정치\" 한계를 실측으로 대체하는 유일한 경로",
          ],
          [
            "37",
            "요원이 다른 길로 갔다 = 새 경로 발견",
            "반복 통과 트레이스를 클러스터링해 비공식 등산로 간선을 그래프에 추가. 24개 단절 컴포넌트를 실제로 잇는 현실적 방법",
          ],
          [
            "38",
            "순찰 결과를 라벨로",
            "\"이상 없음\" = 약한 음성, \"소각 흔적 발견\" = 강한 양성 대리. 산불 이력보다 훨씬 빨리 쌓인다. 장기적 실질 학습 신호",
          ],
          [
            "39",
            "민원 실시간 반영",
            "접수 즉시 해당 격자 위험 규칙 기반 가산(재학습 아님). 재학습은 배치로 분리",
          ],
          [
            "40",
            "선택 편향 (가장 중요)",
            "순찰 간 곳만 라벨이 쌓임 → 안 간 곳은 영원히 모름. 역확률 가중(IPW) 또는 배정의 10~20%를 의도적 탐색에 할당",
          ],
          [
            "41",
            "온라인 학습 금지",
            "실시간 재학습은 피드백 루프 편향 증폭. 일/주 단위 배치 재학습으로 고정",
          ],
        ]}
        columnAlign={["center", "left", "left"]}
        rowTone={["success", "success", "success", undefined, "danger", "warning"]}
      />

      <H2>피드백 · 플래그 · 기상 거리 · 공유 ★추가</H2>
      <Table
        headers={["#", "항목", "처리"]}
        rows={[
          ["38", "순찰 플래그→라벨", "F1 코드만. notes NLP 제외. CLEAR_OK=약한 음성"],
          ["47", "택소노미 버전", "taxonomy_ver. v1 코드 변경 금지"],
          ["48", "grid_id 없는 보고 거부", "GPS→encode 실패 시 제출 불가"],
          ["49", "중복·스팸", "agent+grid+flag+일자 1회"],
          ["50", "미체크 ≠ CLEAR_OK", "최소 1플래그 또는 CLEAR_OK"],
          ["51", "동네예보 5km 1순위", "점관측 보간보다 우선 (P4)"],
          ["52", "다점 IDW+고도보정", "보조. 단일 ASOS 전역복제 금지"],
          ["53", "wx_uncertainty 피처", "모델 입력 + 지도 투명도 (P8)"],
          ["54", "불확실 등급 TOP 남용 금지", "R10. 현장 플래그가 더 신뢰"],
          ["55", "미기후=정적 피처", "남향·침엽수가 15km 기상 변별 보완"],
          ["56", "공유=격자 오버레이", "A9. 전송 버튼 없음"],
          ["57", "공유 단위=관측", "실명·평가 최소화"],
          ["58", "감쇠 플래그 UI 흐림", "half-life와 지도 동기화"],
        ]}
        columnAlign={["center", "left", "left"]}
        rowTone={["danger", "danger", "danger", undefined, "warning", "danger", "danger", "danger", "warning", undefined, "success", undefined, undefined]}
      />

      <H2>시스템 · 법무</H2>
      <Table
        headers={["#", "항목", "처리"]}
        rows={[
          ["42", "지도 응답 무게", "1,553셀 GeoJSON은 무거움. 등급별 단순화 또는 벡터타일"],
          ["43", "개인위치정보", "요원 GPS는 개인위치정보. 보관기간·동의·익명화 명시"],
          ["44", "카카오 키 노출", "JS 키는 클라이언트 노출 불가피 → 도메인 제한 필수"],
          ["45", "발표 중 API 장애", "정적 GeoJSON 스냅샷 + 로컬 폴백 시연 준비 (O2)"],
          ["46", "재현성", "\"다시 돌려보라\" 하면? run_pipeline.py 한 방 (O1)"],
        ]}
        columnAlign={["center", "left", "left"]}
        rowTone={[undefined, "danger", "warning", "danger", "warning"]}
      />
    </Stack>
  );
}

export default function ThreeWeekPlanCanvas() {
  const theme = useHostTheme();
  const [tab, setTab] = useCanvasState<TabId>("plan-tab", "diagnosis");

  return (
    <Stack gap={18} style={{ padding: 20, background: theme.bg.editor, minHeight: "100%" }}>
      <Stack gap={6}>
        <H1>코리요 지킴이 — 남은 3주 실행 계획</H1>
        <Text tone="secondary">
          중간발표 직후 재수립 · 2026-08-06 ~ 08-27 · 플래그·기상거리·암묵공유 반영 · 실무 체크 58항목
        </Text>
      </Stack>

      <TabNav active={tab} onChange={setTab} />
      <Divider />

      {tab === "diagnosis" && <DiagnosisTab />}
      {tab === "goal" && <GoalTab />}
      {tab === "requirements" && <RequirementsTab />}
      {tab === "gantt" && <GanttTab />}
      {tab === "gates" && <GatesTab />}
      {tab === "details" && <DetailsTab />}

      <Divider />
      <Text tone="quaternary" size="small">
        원본 문서: docs/PROJECT_PLAN_3WEEK.md · 근거: docs/FIRE_RISK_PREPROCESSING.md, docs/FEATURE_SCHEMA.md,
        docs/PATROL_ROUTE_OPTIMIZATION.md, analysis/09~12
      </Text>
    </Stack>
  );
}
