/**
 * Extracts pedagogical signals from a raw user message,
 * using a lightweight LLM call for mastery detection,
 * with heuristics as fallback.
 */
import { TurnSignals } from "../types/index.js";
import { chatCompletion } from "./LmStudioClient.js";
import logger from "../utils/logger.js";


const CONFUSION_PATTERNS: RegExp[] = [
  /i don'?t (get|understand|follow|know)/i,
  /what does .+ mean/i,
  /i'?m? (confused|lost|stuck)/i,
  /why does this (work|happen|not work)/i,
  /\?{2,}/,
];


const FRUSTRATION_PATTERNS: RegExp[] = [
  /i'?ve tried everything/i,
  /this (is|makes) no sense/i,
  /ugh|argh|wtf|what the/i,
  /still not (working|broken|wrong)/i,
  /i give up/i,
];


const HELP_SEEKING_PATTERNS: RegExp[] = [
  /can you (help|show|explain|give|tell)/i,
  /how (do|would|should) (i|you|we)/i,
  /what (should|would) (i|you|we)/i,
  /give me a hint/i,
  /show me an? (example|how)/i,
];


const EXPLICIT_TEST_PATTERNS: RegExp[] = [
  /test (me|my)/i,
  /quiz (me|my)/i,
  /assess (me|my)/i,
  /give me a test/i,
  /create a test/i,
  /make a test/i,
  /set (up )?(a )?test/i,
  /want to be tested/i,
  /prove my (knowledge|proficiency|understanding)/i,
  /check (my|what i) know/i,
];


const EXPLICIT_SANDBOX_PATTERNS: RegExp[] = [
  /let me (try|write|code|practice|have a go)/i,
  /i (want to|would like to|can i) try/i,
  /can i (write|try|code|have a go)/i,
  /give me (a |an )?(exercise|challenge|problem|task|practice)/i,
  /something (to practice|hands.?on)/i,
  /let me (practice|have a go|give it a go)/i,
  /i('ll| will) (try|write|give it a go)/i,
  /set (me )?(up )?(a |an )?(challenge|exercise|problem)/i,
];


function heuristicSignals(message: string): Partial<TurnSignals> {
  return {
    confusionDetected:      CONFUSION_PATTERNS.some(p => p.test(message)),
    frustrationDetected:    FRUSTRATION_PATTERNS.some(p => p.test(message)),
    helpSeeking:            HELP_SEEKING_PATTERNS.some(p => p.test(message)),
    conceptualQuestion:     message.includes("?") && message.split(" ").length > 4,
    explicitTestRequest:    EXPLICIT_TEST_PATTERNS.some(p => p.test(message)),
    explicitSandboxRequest: EXPLICIT_SANDBOX_PATTERNS.some(p => p.test(message)),
  };
}


function detectPlagiarismRisk(_message: string, codeSource?: string): boolean {
  if (!codeSource) return false;
  const lineCount = codeSource.split("\n").length;
  return lineCount > 30;
}


export async function extractSignals(
  message:     string,
  codeSource?: string,
): Promise<TurnSignals> {
  const heuristic = heuristicSignals(message);


  let masteryDemonstrated = false;


  try {
    const response = await chatCompletion(
      [
        {
          role:    "system",
          content: `You are a pedagogical signal classifier. Given a student message, respond ONLY with a JSON object: {"masteryDemonstrated": boolean, "reason": string}. masteryDemonstrated is true if the student clearly explains WHY something works, correctly predicts behaviour, or gives an accurate and unprompted explanation of a concept.`,
        },
        {
          role:    "user",
          content: `Student message: ${message}`,
        },
      ],
      { temperature: 0.1, max_tokens: 80, json_mode: true },
    );


    const parsed = JSON.parse(response) as { masteryDemonstrated: boolean };
    masteryDemonstrated = parsed.masteryDemonstrated ?? false;
  } catch (err) {
    logger.warn("Signal extraction LLM call failed, defaulting mastery=false", err);
  }


  return {
    confusionDetected:      heuristic.confusionDetected      ?? false,
    frustrationDetected:    heuristic.frustrationDetected    ?? false,
    helpSeeking:            heuristic.helpSeeking            ?? false,
    conceptualQuestion:     heuristic.conceptualQuestion     ?? false,
    masteryDemonstrated,
    plagiarismRisk:         detectPlagiarismRisk(message, codeSource),
    explicitTestRequest:    heuristic.explicitTestRequest    ?? false,
    explicitSandboxRequest: heuristic.explicitSandboxRequest ?? false,
  };
}