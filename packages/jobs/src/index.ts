/**
 * @argoniq/jobs — shared background-job contracts + a lightweight pg-boss producer.
 * The web tier enqueues (`getJobProducer`); `services/worker` consumes the same queues
 * with the same payload schemas. Neither imports the other.
 */
export * from './contracts.js';
export * from './producer.js';
