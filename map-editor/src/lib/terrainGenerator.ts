export function generateContinent(cols: number, rows: number): boolean[][] {
  let grid: boolean[][] = Array.from({ length: cols }, () => Array(rows).fill(false));

  const centerX = cols / 2;
  const centerY = rows / 2;
  const radiusX = cols * 0.45;
  const radiusY = rows * 0.45;

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= 1.0) {
        // Falloff pour que le centre soit plus dense
        const chance = 0.55 - (distSq * 0.3);
        grid[x][y] = Math.random() < chance;
      }
    }
  }

  const iterations = 6;
  for (let i = 0; i < iterations; i++) {
    const newGrid = Array.from({ length: cols }, () => Array(rows).fill(false));
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        let neighbors = 0;
        for (let nx = x - 1; nx <= x + 1; nx++) {
          for (let ny = y - 1; ny <= y + 1; ny++) {
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
              if (nx !== x || ny !== y) {
                if (grid[nx][ny]) neighbors++;
              }
            }
          }
        }
        
        if (grid[x][y]) {
          newGrid[x][y] = neighbors >= 4;
        } else {
          newGrid[x][y] = neighbors >= 5;
        }
      }
    }
    grid = newGrid;
  }

  return grid;
}
