/**
 * 동선 최적화 레이어 개발용 더미.
 * data/processed/hsfram_parcel_contacts.csv 유일격자 seed=42 샘플 20.
 */
const ROUTE_DEV_TYPE_KO = {
  paddy: "논",
  field: "밭",
  facility: "시설",
  orchard: "과수",
};

const ROUTE_DEV_GRIDS = [
  {"id": "2162231", "grid_id": "다바 083 184", "type": "paddy", "lon": 126.84518613365866, "lat": 37.02518039690735, "emd_name": "장안면", "score": 98, "dangerLevel": "위험도 높음", "rank": 1},
  {"id": "2067318", "grid_id": "다사 095 035", "type": "field", "lon": 126.90838886390289, "lat": 37.25570802486887, "emd_name": "매송면", "score": 96, "dangerLevel": "위험도 높음", "rank": 2},
  {"id": "2205896", "grid_id": "다사 079 008", "type": "field", "lon": 126.82432355696048, "lat": 37.13517674354432, "emd_name": "장안면", "score": 94, "dangerLevel": "위험도 높음", "rank": 3},
  {"id": "2144415", "grid_id": "다바 101 194", "type": "field", "lon": 126.94573811654269, "lat": 37.07091394039943, "emd_name": "양감면", "score": 92, "dangerLevel": "위험도 높음", "rank": 4},
  {"id": "2083456", "grid_id": "다사 106 014", "type": "field", "lon": 126.97562627466438, "lat": 37.16459819007542, "emd_name": "정남면", "score": 90, "dangerLevel": "위험도 높음", "rank": 5},
  {"id": "12435928", "grid_id": "다사 060 021", "type": "field", "lon": 126.71406706041476, "lat": 37.19265694815113, "emd_name": "서신면", "score": 88, "dangerLevel": "위험도 높음", "rank": 6},
  {"id": "2104763", "grid_id": "다사 110 022", "type": "field", "lon": 126.99487688502148, "lat": 37.20118861108662, "emd_name": "안녕동", "score": 86, "dangerLevel": "위험도 높음", "rank": 7},
  {"id": "2187924", "grid_id": "다바 069 199", "type": "paddy", "lon": 126.7670473588119, "lat": 37.09401712593794, "emd_name": "우정읍", "score": 84, "dangerLevel": "위험도 높음", "rank": 8},
  {"id": "2187582", "grid_id": "다바 072 198", "type": "field", "lon": 126.78171907420516, "lat": 37.09053140526944, "emd_name": "우정읍", "score": 82, "dangerLevel": "위험도 높음", "rank": 9},
  {"id": "2208060", "grid_id": "다사 057 010", "type": "paddy", "lon": 126.69647989839896, "lat": 37.14423631162765, "emd_name": "서신면", "score": 80, "dangerLevel": "위험도 높음", "rank": 10},
  {"id": "2188145", "grid_id": "다사 077 005", "type": "field", "lon": 126.81015563985936, "lat": 37.11977916555049, "emd_name": "우정읍", "score": 78, "dangerLevel": "위험도 높음", "rank": 11},
  {"id": "2152775", "grid_id": "다바 078 190", "type": "field", "lon": 126.8160187082013, "lat": 37.05242357931412, "emd_name": "장안면", "score": 76, "dangerLevel": "위험도 높음", "rank": 12},
  {"id": "2154489", "grid_id": "다바 072 195", "type": "paddy", "lon": 126.7825203858532, "lat": 37.07427808235696, "emd_name": "우정읍", "score": 74, "dangerLevel": "위험도 높음", "rank": 13},
  {"id": "2133814", "grid_id": "다사 076 029", "type": "field", "lon": 126.80177689444967, "lat": 37.22777586035534, "emd_name": "남양읍", "score": 72, "dangerLevel": "위험도 높음", "rank": 14},
  {"id": "2132378", "grid_id": "다사 082 031", "type": "field", "lon": 126.8358286411144, "lat": 37.23740237883308, "emd_name": "비봉면", "score": 70, "dangerLevel": "위험도 높음", "rank": 15},
  {"id": "2075025", "grid_id": "다사 073 032", "type": "paddy", "lon": 126.78786815048332, "lat": 37.24106891652463, "emd_name": "남양읍", "score": 68, "dangerLevel": "위험도 높음", "rank": 16},
  {"id": "2097252", "grid_id": "다사 054 016", "type": "paddy", "lon": 126.68141425979776, "lat": 37.17233541507337, "emd_name": "서신면", "score": 66, "dangerLevel": "위험도 높음", "rank": 17},
  {"id": "2104639", "grid_id": "다사 109 023", "type": "paddy", "lon": 126.99225559537084, "lat": 37.20467279623302, "emd_name": "안녕동", "score": 64, "dangerLevel": "위험도 높음", "rank": 18},
  {"id": "2100656", "grid_id": "다사 053 015", "type": "field", "lon": 126.6722548849445, "lat": 37.16727901171159, "emd_name": "서신면", "score": 62, "dangerLevel": "위험도 높음", "rank": 19},
  {"id": "13378107", "grid_id": "다사 073 018", "type": "field", "lon": 126.7855479000895, "lat": 37.181766426806455, "emd_name": "마도면", "score": 60, "dangerLevel": "위험도 높음", "rank": 20},
].map((g, i) => ({ ...g, rank: g.rank ?? (i + 1) }));
