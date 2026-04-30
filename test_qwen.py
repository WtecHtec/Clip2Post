from openai import OpenAI
# Configured by environment variables
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="sk-1234567890"
)

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": "https://qianwen-res.oss-accelerate.aliyuncs.com/Qwen3.5/demo/RealWorld/RealWorld-04.png"
                }
            },
            {
                "type": "text",
                "text": "这是哪里"
            }
        ]
    }
]

chat_response = client.chat.completions.create(
    model="qwen3.5:0.8b",
    messages=messages,
    max_tokens=32768,
    temperature=1.0,
    top_p=1.0,
    presence_penalty=2.0,
    extra_body={
        "top_k": 20,
    }, 
)
print("Chat response:", chat_response)
