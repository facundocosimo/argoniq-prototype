import { mergeConfig } from 'vitest/config';
import { vitestBase } from '@argoniq/config/vitest/base';

export default mergeConfig(vitestBase, {
  test: { name: 'contracts' },
});
