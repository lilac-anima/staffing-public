// Parse a single fresh CLI process without retaining prompt or tool output.
export function createUsageParser() {
  let thread=false, inTurn=false, failed=false, completed=0, input=0, output=0, cached=0, reasoning=0, cachedKnown=true, reasoningKnown=true;
  const number=n=>Number.isSafeInteger(n)&&n>=0;
  return {
    event(e) {
      if (!e || typeof e!=='object' || typeof e.type!=='string') {failed=true;return;}
      // Child agents can consume usage outside this stream. Any known delegation event makes totals unverified.
      const labels=[e.type,e.item?.type,e.item?.tool,e.item?.name,e.item?.server].filter(x=>typeof x==='string');
      if(labels.some(x=>/(?:collab|subagent|sub_agent|spawn_agent|followup_task|send_message|wait_agent|agent\.spawn|agent\.start|delegate)/i.test(x)) || e.item?.newThreadId || e.item?.receiverThreadId || e.item?.new_thread_id || e.item?.receiver_thread_id) failed=true;
      const events=['thread.started','turn.started','turn.completed','turn.failed','item.started','item.updated','item.completed','error'];const items=['agent_message','reasoning','command_execution','file_change','mcp_tool_call','web_search','todo_list','error'];
      if(!events.includes(e.type) || (e.type.startsWith('item.') && !items.includes(e.item?.type)))failed=true;
      if(e.item?.type==='command_execution' && typeof e.item.command==='string' && /(?:^|[;&|]\s*)(?:(?:env|command|exec)\s+)*(?:\/[^\s;|&]+\/)?codex(?:\s|$)/i.test(e.item.command))failed=true;
      if(e.type==='thread.started') {if(thread || typeof e.thread_id!=='string' || !e.thread_id) failed=true; thread=true;}
      else if(e.type==='turn.started') {if(!thread || inTurn) failed=true;inTurn=true;}
      else if(e.type==='turn.completed') {
        if(!thread || !inTurn || failed) {failed=true;return;} inTurn=false;
        const u=e.usage; if(!u || !number(u.input_tokens) || !number(u.output_tokens) || (u.cached_input_tokens!=null && (!number(u.cached_input_tokens)||u.cached_input_tokens>u.input_tokens)) || (u.reasoning_output_tokens!=null && (!number(u.reasoning_output_tokens)||u.reasoning_output_tokens>u.output_tokens))) {failed=true;return;}
        const nextInput=input+u.input_tokens,nextOutput=output+u.output_tokens,nextCached=cached+(u.cached_input_tokens??0),nextReasoning=reasoning+(u.reasoning_output_tokens??0);
        if(!number(nextInput)||!number(nextOutput)||!number(nextCached)||!number(nextReasoning)){failed=true;return;}
        input=nextInput;output=nextOutput;cached=nextCached;reasoning=nextReasoning;completed++;
        if(u.cached_input_tokens==null)cachedKnown=false;if(u.reasoning_output_tokens==null)reasoningKnown=false;
      } else if(e.type==='turn.failed'||e.type==='error') failed=true;
    },
    malformed(){failed=true;},
    partial(){return completed>0 ? {inputTokens:input,outputTokens:output,cachedInputTokens:cachedKnown?cached:null,reasoningOutputTokens:reasoningKnown?reasoning:null} : {inputTokens:null,outputTokens:null,cachedInputTokens:null,reasoningOutputTokens:null};},
    result(exitCode, streamComplete=true) { const complete=thread && !inTurn && completed>0 && !failed && exitCode===0 && streamComplete; return {complete,...this.partial()}; }
  };
}
