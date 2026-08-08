import {
  Button,
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
  Spacer,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type StepId = "overview" | "encode" | "generate" | "filter" | "usage";

const STEPS: { id: StepId; label: string }[] = [
  { id: "overview", label: "1. 좌표계" },
  { id: "encode", label: "2. ID 생성" },
  { id: "generate", label: "3. 격자 폴리곤" },
  { id: "filter", label: "4. 학습 셀 선별" },
  { id: "usage", label: "5. 프로젝트 연결" },
];

const EXAMPLE = {
  x: 954154.5,
  y: 1917704.1,
  originX: 700000,
  originY: 1300000,
  block: 100000,
  res: 500,
  dx: 254154.5,
  dy: 617704.1,
  bx: 2,
  by: 6,
  hangul: "다사",
  ix: 108,
  iy: 35,
  gridId: "다사 108 035",
  dbKey: "다사108035",
  bounds: [954000, 1917500, 954500, 1918000] as const,
  center: [954250, 1917750] as const,
};

const CELL_COUNTS = [
  { stage: "bbox 전체 500m 셀", count: "약 2,500+", note: "임상도 extent 기준" },
  { stage: "임상도 ∩ 입지토양도", count: "2,412", note: "양 레이어 면적 교차" },
  { stage: "산림 점유율 ≥ 10%", count: "1,553", note: "최종 학습 대상 셀" },
];

function StepNav({
  active,
  onChange,
}: {
  active: StepId;
  onChange: (id: StepId) => void;
}) {
  const theme = useHostTheme();
  return (
    <Row gap={8} wrap>
      {STEPS.map((s) => {
        const selected = active === s.id;
        return (
          <Button
            key={s.id}
            onClick={() => onChange(s.id)}
            style={{
              background: selected ? theme.accent.primary : theme.fill.secondary,
              color: selected ? theme.text.onAccent : theme.text.primary,
              border: `1px solid ${selected ? theme.accent.primary : theme.stroke.secondary}`,
              fontSize: 12,
              padding: "6px 12px",
            }}
          >
            {s.label}
          </Button>
        );
      })}
    </Row>
  );
}

function OriginDiagram() {
  const theme = useHostTheme();
  const w = 420;
  const h = 280;
  const pad = 40;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="UTM-K 기준점과 100km 블록 구조">
      <rect x={0} y={0} width={w} height={h} fill={theme.bg.editor} />
      <rect
        x={pad}
        y={pad}
        width={innerW}
        height={innerH}
        fill={theme.fill.tertiary}
        stroke={theme.stroke.primary}
        strokeWidth={1}
      />
      <line x1={pad} y1={pad + innerH} x2={pad + innerW} y2={pad + innerH} stroke={theme.accent.primary} strokeWidth={2} />
      <line x1={pad} y1={pad} x2={pad} y2={pad + innerH} stroke={theme.accent.primary} strokeWidth={2} />
      <circle cx={pad} cy={pad + innerH} r={5} fill={theme.accent.primary} />
      <text x={pad + 8} y={pad + innerH - 8} fill={theme.text.primary} fontSize={11}>
        UTM-K 원점
      </text>
      <rect
        x={pad + 18}
        y={pad + innerH - 92}
        width={92}
        height={74}
        fill={theme.fill.secondary}
        stroke={theme.stroke.secondary}
        strokeWidth={1}
      />
      <text x={pad + 24} y={pad + innerH - 72} fill={theme.text.secondary} fontSize={10}>
        기준점
      </text>
      <text x={pad + 24} y={pad + innerH - 54} fill={theme.text.primary} fontSize={11}>
        X = 700,000
      </text>
      <text x={pad + 24} y={pad + innerH - 38} fill={theme.text.primary} fontSize={11}>
        Y = 1,300,000
      </text>
      <text x={pad + 24} y={pad + innerH - 22} fill={theme.text.tertiary} fontSize={10}>
        (500m 배수)
      </text>
      <rect
        x={pad + 130}
        y={pad + 36}
        width={150}
        height={120}
        fill="none"
        stroke={theme.accent.primary}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <text x={pad + 136} y={pad + 28} fill={theme.accent.primary} fontSize={11}>
        100km 블록 → 한글 2자 (예: 다사)
      </text>
      <g>
        {Array.from({ length: 5 }).map((_, i) =>
          Array.from({ length: 5 }).map((__, j) => (
            <rect
              key={`${i}-${j}`}
              x={pad + 130 + j * 30}
              y={pad + 36 + i * 24}
              width={30}
              height={24}
              fill={theme.fill.primary}
              stroke={theme.stroke.tertiary}
              strokeWidth={0.5}
            />
          )),
        )}
      </g>
      <text x={pad + 130} y={pad + 178} fill={theme.text.secondary} fontSize={10}>
        블록 내부: 500m × 500m = 200×200칸 → 인덱스 3자리 (000~199)
      </text>
      <text x={pad} y={h - 10} fill={theme.text.tertiary} fontSize={10}>
        좌표계 EPSG:5179 (UTM-K) · 근거: 도로명주소법 시행령 제37조 · src/grid.py
      </text>
    </svg>
  );
}

function EncodeDiagram() {
  const theme = useHostTheme();
  const w = 520;
  const h = 300;
  const ex = EXAMPLE;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="좌표에서 격자 ID로 변환하는 단계">
      <rect x={0} y={0} width={w} height={h} fill={theme.bg.editor} />
      {[
        { y: 24, title: "입력 좌표 (EPSG:5179)", body: `X=${ex.x}  Y=${ex.y}` },
        { y: 72, title: "기준점 차분", body: `dx=${ex.dx}  dy=${ex.dy}` },
        { y: 120, title: "100km 블록 인덱스", body: `bx=${ex.bx} → '${ex.hangul[0]}'   by=${ex.by} → '${ex.hangul[1]}'` },
        { y: 168, title: "블록 내 500m 인덱스", body: `ix=${ex.ix}  iy=${ex.iy}  (자리수 3)` },
        { y: 216, title: "격자 ID", body: `"${ex.gridId}"  /  DB키 "${ex.dbKey}"` },
      ].map((row, i) => (
        <g key={row.title}>
          <rect
            x={24}
            y={row.y}
            width={472}
            height={40}
            fill={i === 4 ? theme.fill.secondary : theme.fill.tertiary}
            stroke={i === 4 ? theme.accent.primary : theme.stroke.secondary}
            strokeWidth={1}
          />
          <text x={36} y={row.y + 16} fill={theme.text.secondary} fontSize={10}>
            {row.title}
          </text>
          <text x={36} y={row.y + 32} fill={theme.text.primary} fontSize={12}>
            {row.body}
          </text>
          {i < 4 && (
            <text x={250} y={row.y + 52} fill={theme.text.tertiary} fontSize={14} textAnchor="middle">
              ↓
            </text>
          )}
        </g>
      ))}
      <text x={24} y={284} fill={theme.text.tertiary} fontSize={10}>
        역변환: cell_bounds → (954000, 1917500, 954500, 1918000) · 중심 (954250, 1917750)
      </text>
    </svg>
  );
}

function GridCellDiagram() {
  const theme = useHostTheme();
  const w = 420;
  const h = 260;
  const cell = 36;
  const ox = 80;
  const oy = 40;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="500m 격자 폴리곤 생성 과정">
      <rect x={0} y={0} width={w} height={h} fill={theme.bg.editor} />
      <text x={20} y={22} fill={theme.text.secondary} fontSize={11}>
        grid_polygons(minx, miny, maxx, maxy, res=500)
      </text>
      {Array.from({ length: 4 }).map((_, i) =>
        Array.from({ length: 5 }).map((__, j) => {
          const highlight = i === 1 && j === 2;
          return (
            <rect
              key={`${i}-${j}`}
              x={ox + j * cell}
              y={oy + i * cell}
              width={cell}
              height={cell}
              fill={highlight ? theme.accent.control : theme.fill.tertiary}
              stroke={highlight ? theme.accent.primary : theme.stroke.secondary}
              strokeWidth={highlight ? 1.5 : 0.8}
            />
          );
        }),
      )}
      <line
        x1={ox + 2 * cell}
        y1={oy + cell}
        x2={ox + 2 * cell + cell / 2}
        y2={oy + cell + cell / 2}
        stroke={theme.accent.primary}
        strokeWidth={1}
      />
      <text x={ox + 2 * cell + cell / 2 + 6} y={oy + cell + cell / 2 + 4} fill={theme.accent.primary} fontSize={10}>
        예시 셀
      </text>
      <text x={20} y={oy + 4 * cell + 36} fill={theme.text.primary} fontSize={11}>
        1. bbox를 기준점(700000, 1300000)에 스냅
      </text>
      <text x={20} y={oy + 4 * cell + 52} fill={theme.text.primary} fontSize={11}>
        2. 500m 간격으로 xs, ys 배열 생성
      </text>
      <text x={20} y={oy + 4 * cell + 68} fill={theme.text.primary} fontSize={11}>
        3. 각 셀 box + encode(중심점) → grid_id 부여
      </text>
      <text x={20} y={oy + 4 * cell + 84} fill={theme.text.primary} fontSize={11}>
        4. 임상도·토양도와 overlay → 면적가중 집계
      </text>
      <text x={20} y={h - 8} fill={theme.text.tertiary} fontSize={10}>
        폴리곤/라인은 representative_point 대신 overlay 필수 (assign_grid 주의)
      </text>
    </svg>
  );
}

function PipelineDiagram() {
  const theme = useHostTheme();
  const nodes = [
    { x: 20, label: "경위도\n(WGS84)" },
    { x: 130, label: "EPSG:5179\n변환" },
    { x: 240, label: "encode()\ngrid_id" },
    { x: 350, label: "위험도\n예측" },
    { x: 460, label: "순찰\n배정" },
  ];

  return (
    <svg width={560} height={120} viewBox="0 0 560 120" aria-label="격자 ID가 위험도와 순찰을 연결하는 파이프라인">
      <rect x={0} y={0} width={560} height={120} fill={theme.bg.editor} />
      {nodes.map((n, i) => (
        <g key={n.label}>
          <rect
            x={n.x}
            y={30}
            width={88}
            height={52}
            fill={i >= 3 ? theme.fill.secondary : theme.fill.tertiary}
            stroke={i >= 3 ? theme.accent.primary : theme.stroke.secondary}
            strokeWidth={1}
          />
          {n.label.split("\n").map((line, li) => (
            <text
              key={line}
              x={n.x + 44}
              y={48 + li * 14}
              fill={theme.text.primary}
              fontSize={11}
              textAnchor="middle"
            >
              {line}
            </text>
          ))}
          {i < nodes.length - 1 && (
            <text x={n.x + 96} y={58} fill={theme.text.tertiary} fontSize={16}>
              →
            </text>
          )}
        </g>
      ))}
      <text x={20} y={104} fill={theme.text.tertiary} fontSize={10}>
        GRID_RES=500 단일 상수 · 위험 격자 ID를 순찰 대상으로 그대로 전달
      </text>
    </svg>
  );
}

function OverviewStep() {
  const theme = useHostTheme();
  return (
    <Stack gap={16}>
      <Text color={theme.text.secondary}>
        국가지점번호 체계(도로명주소법 시행령 제37조)를 그대로 따릅니다. 좌표계는 UTM-K(EPSG:5179)이고,
        프로젝트 전역 해상도는 <Code>GRID_RES = 500</Code>m 하나로 통일합니다.
      </Text>
      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader title="계층 구조" />
          <CardBody>
            <OriginDiagram />
          </CardBody>
        </Card>
        <Stack gap={12}>
          <Stat label="격자 해상도" value="500 m" tone="accent" />
          <Stat label="학습 대상 셀" value="1,553" tone="neutral" />
          <Stat label="100km 블록" value="한글 2자" tone="neutral" />
          <Stat label="블록 내 인덱스" value="000 ~ 199" tone="neutral" />
        </Stack>
      </Grid>
    </Stack>
  );
}

function EncodeStep() {
  return (
    <Stack gap={16}>
      <Text>
        <Code>encode(x, y, res=500)</Code>는 UTM-K 좌표를 블록 한글 + 숫자 인덱스로 변환합니다.
        경위도 입력은 <Code>from_lonlat(lon, lat)</Code>가 pyproj로 5179 변환 후 encode를 호출합니다.
      </Text>
      <Card>
        <CardHeader title="실제 예시 (src/grid.py docstring)" />
        <CardBody>
          <EncodeDiagram />
        </CardBody>
      </Card>
      <Table
        columns={[
          { key: "fn", header: "함수", width: "28%" },
          { key: "in", header: "입력" },
          { key: "out", header: "출력" },
        ]}
        rows={[
          { fn: "encode()", in: "954154.5, 1917704.1", out: "다사 108 035" },
          { fn: "decode()", in: "다사 108 035", out: "중심 (954250, 1917750)" },
          { fn: "cell_bounds()", in: "다사 108 035", out: "954000~954500, 1917500~1918000" },
          { fn: "from_lonlat()", in: "126.9830, 37.2571", out: "다사 108 035" },
        ]}
      />
    </Stack>
  );
}

function GenerateStep() {
  return (
    <Stack gap={16}>
      <Text>
        면적가중 집계가 필요한 임상도·토양도는 점 대표값(<Code>assign_grid</Code>)이 아니라{" "}
        <Code>grid_polygons()</Code>로 만든 500m 폴리곤과 spatial overlay 합니다.
      </Text>
      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader title="grid_polygons 생성 흐름" />
          <CardBody>
            <GridCellDiagram />
          </CardBody>
        </Card>
        <Stack gap={12}>
          <H3>스냅 공식</H3>
          <Code>{`x0 = ORIGIN_X + floor((minx - ORIGIN_X) / res) * res
y0 = ORIGIN_Y + floor((miny - ORIGIN_Y) / res) * res
xs = arange(x0, maxx + res, res)`}</Code>
          <Divider />
          <H3>왜 기준점 스냅인가</H3>
          <Text>
            기준점 (700000, 1300000)이 500의 배수이므로 500m 격자 경계가 국가지점번호와 정확히 일치합니다.
            등산로 표지판의 지점번호와 같은 체계를 씁니다.
          </Text>
        </Stack>
      </Grid>
    </Stack>
  );
}

function FilterStep() {
  const theme = useHostTheme();
  return (
    <Stack gap={16}>
      <Text>
        화성 임상도 bbox 위에 격자를 깔고, 임상도·입지토양도와 면적 교차한 뒤 산림 점유율 10% 이상만
        남깁니다. 근거 스크립트: <Code>analysis/12_grid500_features.py</Code>
      </Text>
      <Table
        columns={[
          { key: "stage", header: "단계", width: "34%" },
          { key: "count", header: "셀 수", align: "right" },
          { key: "note", header: "기준" },
        ]}
        rows={CELL_COUNTS}
      />
      <Card>
        <CardHeader title="셀 선별 파이프라인" />
        <CardBody>
          <Row gap={8} wrap align="center">
            {["임상도 bbox", "grid_polygons", "임상∩토양 overlay", "forest_ratio≥0.1", "1,553 셀"].map(
              (label, i, arr) => (
                <Row key={label} gap={8} align="center">
                  <Pill tone={i === arr.length - 1 ? "accent" : "neutral"}>{label}</Pill>
                  {i < arr.length - 1 && (
                    <Text color={theme.text.tertiary} style={{ fontSize: 14 }}>
                      →
                    </Text>
                  )}
                </Row>
              ),
            )}
          </Row>
        </CardBody>
      </Card>
    </Stack>
  );
}

function UsageStep() {
  return (
    <Stack gap={16}>
      <Text>
        위험도 모델과 순찰 배정이 같은 <Code>grid_id</Code>를 공유해야 "위험 격자 → 순찰 대상" 파이프라인이
        성립합니다. 등산로 라인에는 <Code>assign_grid(res=500)</Code>로 대표점 ID를 부여합니다.
      </Text>
      <Card>
        <CardHeader title="단일 ID 파이프라인" />
        <CardBody>
          <PipelineDiagram />
        </CardBody>
      </Card>
      <Grid columns={3} gap={12}>
        <Stat label="정적 피처 테이블" value="1,553 행" tone="neutral" />
        <Stat label="동적 기상 (1년)" value="1,360만 행" tone="neutral" />
        <Stat label="실시간 추론" value="1,553 행" tone="accent" />
      </Grid>
    </Stack>
  );
}

export default function GridSystemCanvas() {
  const theme = useHostTheme();
  const [step, setStep] = useCanvasState<StepId>("grid-step", "overview");

  return (
    <Stack gap={20} style={{ padding: 20, background: theme.bg.editor, minHeight: "100%" }}>
      <Stack gap={8}>
        <H1>국가지점번호 500m 격자 시스템</H1>
        <Text color={theme.text.secondary}>
          src/grid.py · EPSG:5179 · GRID_RES=500 · 화성시 산불 위험도 / 순찰 통합 격자
        </Text>
      </Stack>

      <StepNav active={step} onChange={setStep} />
      <Divider />

      {step === "overview" && <OverviewStep />}
      {step === "encode" && <EncodeStep />}
      {step === "generate" && <GenerateStep />}
      {step === "filter" && <FilterStep />}
      {step === "usage" && <UsageStep />}

      <Spacer size={8} />
      <Text color={theme.text.tertiary} style={{ fontSize: 11 }}>
        Source: src/grid.py, analysis/07_national_grid.py, analysis/12_grid500_features.py, docs/FEATURE_SCHEMA.md
      </Text>
    </Stack>
  );
}
