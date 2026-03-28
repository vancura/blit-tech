import { bench, describe } from 'vitest';

import { Vector2i } from './Vector2i';

describe('Vector2i benchmarks', () => {
    const a = Vector2i.fromXYUnchecked(17, 23);
    const b = Vector2i.fromXYUnchecked(5, 11);

    bench(
        'add',
        () => {
            a.add(b);
        },
        {
            iterations: 2_000,
            warmupIterations: 200,
        },
    );
});
