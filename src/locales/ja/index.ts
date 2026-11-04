// 화면별 번역 파일을 하나로 합친다. 파일을 더하면 여기를 고치지 않아도 들어온다
const files = import.meta.glob<Record<string, string>>('./*.json', {
  eager: true,
  import: 'default',
});

export default Object.assign({}, ...Object.values(files)) as Record<string, string>;
