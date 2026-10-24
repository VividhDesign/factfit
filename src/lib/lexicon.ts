/**
 * Tech terms the guard watches for (G4). If a claim names one, the cited facts or the profile's
 * skills must name it too. Lowercase. Ambiguous English words (go, r, c, swift, spring, express,
 * spark, ray) are left out on purpose; use the longer product name instead.
 */
const GROUPS: Record<string, string> = {
  languages:
    "python,c++,c++11,c++14,c++17,c++20,javascript,typescript,java,kotlin,scala,rust,golang,ruby,php,perl,haskell,elixir,erlang,matlab,julia,bash,powershell,sql,pl/sql,html,css,sass,objective-c,swiftui,cuda,verilog,vhdl,assembly,webassembly,wasm,solidity,groovy,lua,clojure,fortran,cobol",
  web:
    "react,react native,next.js,nextjs,vue,vue.js,angular,svelte,node.js,nodejs,express.js,expressjs,nestjs,django,flask,fastapi,spring boot,rails,ruby on rails,laravel,graphql,grpc,websocket,websockets,tailwind,redux,webpack,vite,jquery,electron,flutter,streamlit,gradio,jinja",
  databases:
    "mongodb,postgresql,postgres,mysql,mariadb,sqlite,redis,memcached,cassandra,dynamodb,elasticsearch,opensearch,solr,neo4j,couchdb,firebase,firestore,supabase,snowflake,bigquery,redshift,clickhouse,sql server,cockroachdb,influxdb,timescaledb,pinecone,weaviate,milvus,qdrant,chroma,pgvector,faiss,hnsw,hnswlib,usearch,scann",
  cloud:
    "aws,azure,gcp,google cloud,lambda,s3,ec2,ecs,eks,fargate,sagemaker,bedrock,kinesis,eventbridge,step functions,sns,sqs,cloudformation,cloudwatch,api gateway,amplify,cognito,cdk,vercel,netlify,heroku,cloudflare,digitalocean,vertex ai,azure functions,databricks",
  devops:
    "docker,kubernetes,k8s,helm,terraform,ansible,pulumi,jenkins,github actions,gitlab ci,circleci,travis,istio,nginx,prometheus,grafana,datadog,splunk,kafka,rabbitmq,celery,airflow,dbt,hadoop,apache spark,pyspark,flink,linux,unix,git,cmake,bazel,gradle,maven,ci/cd,devops,microservices,serverless",
  ml:
    "pytorch,tensorflow,keras,jax,scikit-learn,sklearn,xgboost,lightgbm,catboost,numpy,scipy,pandas,polars,matplotlib,seaborn,plotly,opencv,huggingface,hugging face,transformers,sentence-transformers,langchain,langgraph,llamaindex,openai,gpt-4,chatgpt,gemini,claude,llama,mistral,ollama,groq,bert,rag,lora,rlhf,onnx,tensorrt,mlflow,wandb,weights & biases,cnn,rnn,lstm,gan,diffusion,reinforcement learning,nlp,computer vision,mlops,spacy,nltk,pyserini,bm25,beir,conformer",
  systems:
    "simd,neon,avx2,avx-512,multithreading,atomics,spinlock,mutex,lock-free,pthreads,openmp,mpi,pybind11,threadsanitizer,asan,valgrind,gdb,epoll,io_uring,rdma,fpga,gpu,tpu,raft,paxos,grpc,protobuf,flatbuffers,llvm,gcc,clang,jit",
  tools:
    "jira,confluence,figma,postman,swagger,openapi,jupyter,colab,vscode,intellij,tableau,power bi,looker,pytest,junit,jest,mocha,selenium,cypress,playwright,sonarqube,sentry,stripe,twilio,telegram,slack,oauth,jwt,saml",
  hardware: "arduino,raspberry pi,esp32,stm32,autocad,solidworks,simulink,labview",
};

export const LEXICON: string[] = [...new Set(Object.values(GROUPS).flatMap((g) => g.split(",")))];

/** Regex that finds `term` as a whole word (digits may follow, so "c++" matches "c++17"). */
export function termRegex(term: string): RegExp {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9+#])${esc}(?![a-z+#])`, "i");
}
