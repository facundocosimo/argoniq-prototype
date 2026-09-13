/**
 * Answer orchestration shared by the application service and evaluation harness.
 * `runAnswerPipeline` composes normalization, safety, source isolation, ranking,
 * grounding, and generation in a fixed order.
 */
export * from './answer-pipeline.js';
