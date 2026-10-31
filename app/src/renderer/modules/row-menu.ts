export const toggleDetailMenu = (
  target: HTMLElement,
  closeDetailMenus: () => void,
) => {
  const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
  if (!detailLine) return false;
  if (detailLine.classList.contains("detail-menu-open")) {
    detailLine.classList.remove("detail-menu-open");
    return false;
  }
  closeDetailMenus();
  detailLine.classList.add("detail-menu-open");
  return true;
};
