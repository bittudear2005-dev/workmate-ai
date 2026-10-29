import httpx
from typing import Optional, Dict
from app.config import settings
import json
import re


class AIService:
    def __init__(self):
        self._genai = None
        if settings.ENABLE_GEMINI and settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._genai = genai
            except Exception as e:
                print(f"⚠️ Failed to configure Gemini AI: {e}")
    
    async def chat_with_groq(self, message: str, system_prompt: Optional[str] = None):
        if not settings.ENABLE_GROQ:
            raise Exception("Groq AI is not enabled")
        
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": message})
        
        payload = {
            "model": settings.GROQ_MODEL,
            "messages": messages,
            "temperature": settings.AI_TEMPERATURE,
            "max_tokens": settings.AI_MAX_TOKENS
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "response": result["choices"][0]["message"]["content"],
                "model": settings.GROQ_MODEL,
                "tokens_used": result.get("usage", {}).get("total_tokens", 0)
            }
    
    async def chat_with_gemini(self, message: str, system_prompt: Optional[str] = None):
        if not settings.ENABLE_GEMINI:
            raise Exception("Gemini AI is not enabled")
        
        if not self._genai:
            raise Exception("Gemini AI is unavailable or not configured")
        model = self._genai.GenerativeModel(
            settings.GEMINI_MODEL,
            generation_config={
                "temperature": settings.AI_TEMPERATURE,
                "max_output_tokens": settings.AI_MAX_TOKENS,
            }
        )
        
        full_prompt = message
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{message}"
        
        response = model.generate_content(full_prompt)
        
        return {
            "response": response.text,
            "model": settings.GEMINI_MODEL,
            "tokens_used": None
        }
    
    async def analyze_task(self, task_title: str, task_description: Optional[str] = None):
        prompt = f"""Analyze this task and provide insights in JSON format:

Task: {task_title}
Description: {task_description or 'No description'}

Respond with JSON:
{{
    "priority": "low/medium/high/urgent",
    "estimated_hours": <number>,
    "subtasks": ["subtask1", "subtask2"],
    "tips": ["tip1", "tip2"],
    "challenges": ["challenge1", "challenge2"]
}}"""

        result = await self.chat_with_gemini(
            message=prompt,
            system_prompt="You are a productivity expert. Respond with JSON only."
        )
        
        json_match = re.search(r'\{.*\}', result["response"], re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except:
                pass
        
        return {
            "priority": "medium",
            "estimated_hours": 2.0,
            "subtasks": ["Review requirements", "Plan approach", "Execute"],
            "tips": ["Break into smaller steps"],
            "challenges": ["Time estimation"]
        }
    
    async def summarize_note(self, content: str, length: str = "medium"):
        length_map = {
            "short": "2-3 sentences",
            "medium": "1 paragraph",
            "long": "2-3 paragraphs"
        }
        
        prompt = f"""Summarize this note in {length_map.get(length, '1 paragraph')}:

{content}

Provide JSON:
{{
    "summary": "summary text",
    "key_points": ["point1", "point2"],
    "tags": ["tag1", "tag2"]
}}"""

        result = await self.chat_with_gemini(prompt, "You are an expert summarizer. JSON only.")
        
        json_match = re.search(r'\{.*\}', result["response"], re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group())
                data["word_count"] = len(content.split())
                return data
            except:
                pass
        
        return {
            "summary": content[:200],
            "key_points": ["Main content"],
            "tags": ["general"],
            "word_count": len(content.split())
        }
    
    async def generate_goal_plan(self, goal_title: str, goal_description: Optional[str] = None):
        prompt = f"""Create action plan for this goal:

Goal: {goal_title}
Description: {goal_description or 'Not provided'}

JSON format:
{{
    "milestones": [{{"title": "milestone", "timeline": "2 weeks"}}],
    "actions": ["action1", "action2"],
    "challenges": ["challenge1"],
    "resources": ["resource1"],
    "success_metrics": ["metric1"]
}}"""

        result = await self.chat_with_gemini(prompt, "You are a goal planning expert. JSON only.")
        
        json_match = re.search(r'\{.*\}', result["response"], re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except:
                pass
        
        return {
            "milestones": [{"title": "Planning", "timeline": "1 week"}],
            "actions": ["Define requirements", "Create plan"],
            "challenges": ["Time management"],
            "resources": ["Online resources"],
            "success_metrics": ["Completion rate"]
        }
    
    async def chat(self, message: str, model: str = "gemini", system_prompt: Optional[str] = None):
        try:
            if model == "groq" and settings.ENABLE_GROQ and settings.GROQ_API_KEY:
                return await self.chat_with_groq(message, system_prompt)
            elif settings.ENABLE_GEMINI and settings.GEMINI_API_KEY:
                return await self.chat_with_gemini(message, system_prompt)
            elif settings.ENABLE_GROQ and settings.GROQ_API_KEY:
                return await self.chat_with_groq(message, system_prompt)
            else:
                return {
                    "response": f"👋 Cosmic Assistant received your message: \"{message}\". To enable live AI intelligence, please set your GEMINI_API_KEY or GROQ_API_KEY in the backend .env configuration.",
                    "model": "offline-fallback",
                    "tokens_used": 0
                }
        except Exception as e:
            return {
                "response": f"I received your request, but encountered a connection issue with the AI provider: {str(e)}. Please check your API key in the backend configuration.",
                "model": model,
                "tokens_used": 0
            }


ai_service = AIService()